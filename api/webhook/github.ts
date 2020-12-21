// Copyright 2020 the Deno authors. All rights reserved. MIT license.

/**
 * This function receives webhook events from GitHub. When an event is received
 * the service checks if it comes from GitHub, if the module name and repository
 * ID match up, and if this version of the module has been uploaded already. If
 * all of these checks pass a build is created in MongoDB and the ID of this
 * build is added to the AWS SQS build queue to be processed asynchronously.
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from "../../deps.ts";
import { parseRequestBody, respondJSON } from "../../utils/http.ts";
import { Database, Module } from "../../utils/database.ts";
import {
  getForbiddenWords,
  getMeta,
  uploadMetaJson,
} from "../../utils/storage.ts";
import type {
  WebhookPayloadCreate,
  WebhookPayloadPing,
  WebhookPayloadPush,
} from "../../utils/webhooks.d.ts";
import { isIp4InCidrs } from "../../utils/net.ts";
import { queueBuild } from "../../utils/queue.ts";
import type { VersionInfo } from "../../utils/types.ts";
import { isForbidden } from "../../utils/moderation.ts";

interface WebhookEvent {
  moduleName: string;
  event: APIGatewayProxyEventV2;
}

const decoder = new TextDecoder();

const database = new Database(Deno.env.get("MONGO_URI")!);

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyResultV2> {
  const ip = event.requestContext.http.sourceIp;
  if (!isGitHubHooksIP(ip)) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "request does not come from GitHub",
      }),
    });
  }

  const moduleName = event.pathParameters?.name;
  if (!moduleName) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "no module name specified",
      }),
    });
  }

  const headers = new Headers(event.headers);

  if (
    !(headers.get("content-type") ?? "").startsWith("application/json") &&
    !(headers.get("content-type") ?? "").startsWith(
      "application/x-www-form-urlencoded",
    )
  ) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "content-type is not json or x-www-form-urlencoded",
      }),
    });
  }

  // Check the GitHub event type.
  const ghEvent = headers.get("x-github-event");

  // Decode event body in the case the event is submitted as form-urlencoded
  event = parseRequestBody(event);

  switch (ghEvent) {
    case "ping":
      return pingEvent({ moduleName, event });
    case "push":
      return pushEvent({ moduleName, event });
    case "create":
      return createEvent({ moduleName, event });
    default:
      return respondJSON({
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          info: "not a ping, or create event",
        }),
      });
  }
}

/**
 * Ping event is triggered when the webhook is first registered. It is used to
 * first register the module on deno.land/x but does not upload any versions
 * along with it.
 */
async function pingEvent(
  { moduleName, event }: WebhookEvent,
): Promise<APIGatewayProxyResultV2> {
  // Get version, version type, and repository from event
  if (!event.body) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "no body provided",
      }),
    });
  }
  const webhook = JSON.parse(event.body) as WebhookPayloadPing;
  const [owner, repo] = webhook.repository.full_name.split("/");
  const repoId = webhook.repository.id;
  const description = webhook.repository.description ?? "";
  const starCount = webhook.repository.stargazers_count;
  const sender = webhook.sender.login;
  const subdir =
    decodeURIComponent(event.queryStringParameters?.subdir ?? "") || null;

  const entry = await database.getModule(moduleName);

  const resp = await checkModuleInfo(
    entry,
    moduleName,
    owner,
    sender,
    repoId,
    subdir,
  );
  if (resp) return resp;

  // Update meta information in MongoDB (registers module if not present yet)
  await database.saveModule({
    ...entry ??
      {
        name: moduleName,
        type: "github",
        created_at: new Date(),
        is_unlisted: false,
      },
    repo_id: repoId,
    owner,
    repo,
    description,
    star_count: starCount,
  });

  const versionInfoBody = await getMeta(moduleName, "versions.json");
  if (versionInfoBody === undefined) {
    await uploadMetaJson(
      moduleName,
      "versions.json",
      { latest: null, versions: [] },
    );
  }

  return respondJSON({
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: {
        module: moduleName,
        repository: `${owner}/${repo}`,
      },
    }),
  });
}

/**
 * Push event is triggered when one or more commits are pushed to a ref.
 */
async function pushEvent(
  { moduleName, event }: WebhookEvent,
): Promise<APIGatewayProxyResultV2> {
  // Get version, version type, and repository from event
  if (!event.body) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "no body provided",
      }),
    });
  }
  const webhook = JSON.parse(event.body) as WebhookPayloadPush;
  const { ref: rawRef } = webhook;
  const [owner, repo] = webhook.repository.full_name.split("/");
  const repoId = webhook.repository.id;
  if (!rawRef.startsWith("refs/tags/")) {
    return respondJSON({
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        info: "created ref is not tag",
      }),
    });
  }

  const ref = rawRef.replace(/^refs\/tags\//, "");
  const description = webhook.repository.description ?? "";
  const starCount = webhook.repository.stargazers_count;
  const versionPrefixFilter = decodeURIComponent(
    event.queryStringParameters?.version_prefix_filter ??
      event.queryStringParameters?.version_prefix ?? "",
  );
  const keepVersionPrefix =
    event.queryStringParameters?.keep_version_prefix === "true";
  const subdir =
    decodeURIComponent(event.queryStringParameters?.subdir ?? "") || null;
  const sender = webhook.sender.login;

  return initiateBuild({
    moduleName,
    repoId,
    owner,
    repo,
    sender,
    ref,
    description,
    starCount,
    versionPrefixFilter,
    keepVersionPrefix,
    subdir,
  });
}

/**
 * Create event is triggered when a new branch or tag is created.
 */
async function createEvent(
  { moduleName, event }: WebhookEvent,
): Promise<APIGatewayProxyResultV2> {
  // Get version, version type, and repository from event
  if (!event.body) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "no body provided",
      }),
    });
  }
  const webhook = JSON.parse(event.body) as WebhookPayloadCreate;
  const { ref } = webhook;
  const [owner, repo] = webhook.repository.full_name.split("/");
  const sender = webhook.sender.login;
  const repoId = webhook.repository.id;
  if (webhook.ref_type !== "tag") {
    return respondJSON({
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        info: "created ref is not tag",
      }),
    });
  }

  const description = webhook.repository.description ?? "";
  const starCount = webhook.repository.stargazers_count;
  const versionPrefixFilter = decodeURIComponent(
    event.queryStringParameters?.version_prefix_filter ??
      event.queryStringParameters?.version_prefix ?? "",
  );
  const keepVersionPrefix =
    event.queryStringParameters?.keep_version_prefix === "true";
  const subdir =
    decodeURIComponent(event.queryStringParameters?.subdir ?? "") || null;

  return initiateBuild({
    moduleName,
    repoId,
    owner,
    repo,
    ref,
    description,
    starCount,
    versionPrefixFilter,
    keepVersionPrefix,
    subdir,
    sender,
  });
}

async function initiateBuild(
  options: {
    moduleName: string;
    repoId: number;
    owner: string;
    repo: string;
    sender: string;
    ref: string;
    description: string;
    starCount: number;
    versionPrefixFilter: string;
    keepVersionPrefix: boolean;
    subdir: string | null;
  },
): Promise<APIGatewayProxyResultV2> {
  const {
    moduleName,
    repoId,
    owner,
    repo,
    sender,
    ref,
    description,
    starCount,
    versionPrefixFilter,
    keepVersionPrefix,
    subdir,
  } = options;

  if (!ref.startsWith(versionPrefixFilter)) {
    return respondJSON({
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        info:
          "ignoring event as the version does not match the version prefix filter",
      }),
    });
  }

  const entry = await database.getModule(moduleName);

  const resp = await checkModuleInfo(
    entry,
    moduleName,
    owner,
    sender,
    repoId,
    subdir,
  );
  if (resp) return resp;

  // Update meta information in MongoDB (registers module if not present yet)
  await database.saveModule({
    ...entry ??
      {
        name: moduleName,
        type: "github",
        created_at: new Date(),
        is_unlisted: false,
      },
    repo_id: repoId,
    owner,
    repo,
    description,
    star_count: starCount,
  });

  const version = keepVersionPrefix
    ? ref
    : ref.substring(versionPrefixFilter.length);
  const invalidVersion = await checkVersion(moduleName, version);
  if (invalidVersion) return invalidVersion;

  const buildID = await database.createBuild({
    options: {
      type: "github",
      moduleName,
      repository: `${owner}/${repo}`,
      ref,
      version,
      subdir: subdir ?? undefined,
    },
    status: "queued",
  });

  await queueBuild(buildID);

  return respondJSON({
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: {
        module: moduleName,
        version,
        repository: `${owner}/${repo}`,
        status_url: `https://deno.land/status/${buildID}`,
      },
    }),
  });
}

/**
 * CheckModuleInfo performs a series of general validation on the module such as
 * validating that the module name complies with the naming convention enforced
 * on deno.land/x, whether or not the sender or owner have been blocked etc...
 *
 * These verifications are meant to be performed before the module is registered
 * or updated in the database to prevent "bad" modules from being pushed to the
 * build queue and subsequently published.
 *
 * @param entry database entry for the module
 * @param moduleName module name as shown on deno.land/x
 * @param owner username of the GH repository owner
 * @param sender username of the user triggering the webhoo
 * @param repoId numerical id of the GH repository
 */
async function checkModuleInfo(
  entry: Module | null,
  moduleName: string,
  owner: string,
  sender: string,
  repoId: number,
  subdir: string | null,
): Promise<APIGatewayProxyResultV2 | undefined> {
  return await checkBlocked(sender) ??
    await checkBlocked(owner) ??
    checkSubdir(subdir) ??
    checkMatchesRepo(entry, repoId) ??
    await checkModulesInRepo(entry, repoId) ??
    await hasReachedQuota(entry, owner) ??
    await checkName(entry, moduleName);
}

function checkSubdir(
  subdir: string | null,
): APIGatewayProxyResultV2 | undefined {
  if (subdir !== null) {
    if (subdir.startsWith("/")) {
      return respondJSON({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "provided sub directory is not valid as it starts with a /",
        }),
      });
    } else if (!subdir.endsWith("/")) {
      return respondJSON({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error:
            "provided sub directory is not valid as it does not end with a /",
        }),
      });
    }
  }
  return;
}

async function checkBlocked(
  userName: string,
): Promise<APIGatewayProxyResultV2 | undefined> {
  const user = await database.getOwnerQuota(userName);
  if (user?.blocked ?? false) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: `Publishing your module failed. Please contact ry@deno.land.`,
      }),
    });
  }
  return;
}

function checkMatchesRepo(
  entry: Module | null,
  repoId: number,
): APIGatewayProxyResultV2 | undefined {
  if (
    entry && !(entry.type === "github" && entry.repo_id === repoId)
  ) {
    return respondJSON({
      statusCode: 409,
      body: JSON.stringify({
        success: false,
        error: "module name is registered to a different repository",
      }),
    });
  }
  return;
}

const MAX_MODULES_PER_REPOSITORY = 3;
const MAX_MODULES_PER_OWNER_DEFAULT = 15;

async function checkModulesInRepo(
  entry: Module | null,
  repoId: number,
): Promise<APIGatewayProxyResultV2 | undefined> {
  if (
    !entry && await database.countModulesForRepository(repoId) >=
      MAX_MODULES_PER_REPOSITORY
  ) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error:
          `Max number of modules for one repository (${MAX_MODULES_PER_REPOSITORY}) has been reached. Please contact ry@deno.land if you need more.`,
      }),
    });
  }
  return;
}

async function hasReachedQuota(
  entry: Module | null,
  owner: string,
): Promise<APIGatewayProxyResultV2 | undefined> {
  const ownerQuota = await database.getOwnerQuota(owner);
  const maxModuleQuota = ownerQuota?.max_modules ??
    MAX_MODULES_PER_OWNER_DEFAULT;
  if (
    !entry && await database.countModulesForOwner(owner) >= (maxModuleQuota)
  ) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error:
          `Max number of modules for one user/org (${maxModuleQuota}) has been reached. Please contact ry@deno.land if you need more.`,
      }),
    });
  }
  return;
}

const VALID_NAME = /^[a-z0-9_]{3,40}$/;

async function checkName(
  entry: Module | null,
  moduleName: string,
): Promise<APIGatewayProxyResultV2 | undefined> {
  if (!entry) {
    if (!VALID_NAME.test(moduleName)) {
      return respondJSON({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "module name is not valid",
        }),
      });
    }

    const encoder = new TextDecoder("utf8");
    const res = await getForbiddenWords();
    const badwords = encoder.decode(res).split("\n");
    if (isForbidden(moduleName, badwords)) {
      return respondJSON({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "found forbidden word in module name",
        }),
      });
    }
  }
  return;
}

/**
 * CheckVersion compares the version number being pushed to existing versions or
 * builds for that module.
 *
 * This step is used to avoid re-publishing existing versions of a module. For
 * more context around this design choice, please refer to the
 * [announcement post](https://deno.land/posts/registry2)
 *
 * @param moduleName module name as shown on deno.land/x
 * @param version module version being pushed, stripped of its prefix
 */
async function checkVersion(
  moduleName: string,
  version: string,
): Promise<APIGatewayProxyResultV2 | undefined> {
  // Check that version doesn't already exist
  const versionInfoBody = await getMeta(moduleName, "versions.json");
  const versionInfo: VersionInfo = versionInfoBody
    ? JSON.parse(decoder.decode(versionInfoBody))
    : { versions: [], latest: "" };
  if (versionInfo.versions.includes(version)) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "version already exists",
      }),
    });
  }

  // Check that a build has not already been queued
  const build = await database.getBuildForVersion(moduleName, version);
  if (build !== null && build.status !== "error") {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "this module version is already being published",
      }),
    });
  }
  return;
}

// From https://api.github.com/meta
const GITHUB_HOOKS_CIDRS = [
  "192.30.252.0/22",
  "185.199.108.0/22",
  "140.82.112.0/20",
];

export function isGitHubHooksIP(ip: string): boolean {
  return isIp4InCidrs(ip, GITHUB_HOOKS_CIDRS);
}
