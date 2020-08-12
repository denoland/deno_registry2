// Copyright 2020 the Deno authors. All rights reserved. MIT license.

/**
 * This function receives webhook events from GitHub. When an event is received
 * the service checks if it comes from GitHub, if the module name and repository
 * ID match up, and if this version of the module has been uploaded already. If
 * all of these checks pass a build is created in MongoDB and the ID of this
 * build is added to the AWS SQS build queue to be processed asynchronously.
 */

import {
  APIGatewayProxyEventV2,
  Context,
  APIGatewayProxyResultV2,
} from "../../deps.ts";
import { respondJSON, parseRequestBody } from "../../utils/http.ts";
import { Database } from "../../utils/database.ts";
import { getMeta, uploadMetaJson } from "../../utils/storage.ts";
import type {
  WebhookPayloadPing,
  WebhookPayloadCreate,
  WebhookPayloadPush,
} from "../../utils/webhooks.d.ts";
import { isIp4InCidrs } from "../../utils/net.ts";
import { queueBuild } from "../../utils/queue.ts";
import type { VersionInfo } from "../../utils/types.ts";

const VALID_NAME = /^[a-z0-9_]{3,40}$/;
const MAX_MODULES_PER_REPOSITORY = 3;

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
      return pingEvent({ headers, moduleName, event });
    case "push":
      return pushEvent({ headers, moduleName, event });
    case "create":
      return createEvent({ headers, moduleName, event });
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

async function pingEvent(
  { moduleName, event }: {
    headers: Headers;
    moduleName: string;
    event: APIGatewayProxyEventV2;
  },
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
  const repository = webhook.repository.full_name;
  const description = webhook.repository.description ?? "";
  const starCount = webhook.repository.stargazers_count;

  const resp = await checkAvailable(moduleName, repository);
  if (resp) return resp;

  // Update meta information in MongoDB (registers module if not present yet)
  await database.saveModule({
    name: moduleName,
    type: "github",
    repository,
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
        repository: repository,
      },
    }),
  });
}

async function pushEvent(
  { headers, moduleName, event }: {
    headers: Headers;
    moduleName: string;
    event: APIGatewayProxyEventV2;
  },
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
  const repository = webhook.repository.full_name;
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
  const versionPrefix = decodeURIComponent(
    event.queryStringParameters?.version_prefix ?? "",
  );
  const subdir =
    decodeURIComponent(event.queryStringParameters?.subdir ?? "") || null;

  return initiateBuild({
    moduleName,
    repository,
    ref,
    description,
    starCount,
    versionPrefix,
    subdir,
  });
}

async function createEvent(
  { headers, moduleName, event }: {
    headers: Headers;
    moduleName: string;
    event: APIGatewayProxyEventV2;
  },
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
  const repository = webhook.repository.full_name;
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
  const versionPrefix = decodeURIComponent(
    event.queryStringParameters?.version_prefix ?? "",
  );
  const subdir =
    decodeURIComponent(event.queryStringParameters?.subdir ?? "") || null;

  return initiateBuild({
    moduleName,
    repository,
    ref,
    description,
    starCount,
    versionPrefix,
    subdir,
  });
}

async function checkAvailable(
  moduleName: string,
  repository: string,
): Promise<APIGatewayProxyResultV2 | undefined> {
  const entry = await database.getModule(moduleName);
  if (entry) {
    // Check that entry matches repo
    if (
      !(entry.type === "github" &&
        entry.repository.toLowerCase() === repository.toLowerCase())
    ) {
      return respondJSON({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "module name is registered to a different repository",
        }),
      });
    }
  } else {
    // If this entry doesn't exist yet check how many modules this repo
    // already has.
    if (
      await database.countModulesForRepository(repository) >=
        MAX_MODULES_PER_REPOSITORY
    ) {
      return respondJSON({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error:
            `max number of modules for one repository (${MAX_MODULES_PER_REPOSITORY}) has been reached`,
        }),
      });
    }

    // If module does not exist and limit has not been reached, check if
    // name is valid.
    if (!VALID_NAME.test(moduleName)) {
      return respondJSON({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "module name is not valid",
        }),
      });
    }
  }
}

async function initiateBuild(
  options: {
    moduleName: string;
    repository: string;
    ref: string;
    description: string;
    starCount: number;
    versionPrefix: string;
    subdir: string | null;
  },
): Promise<APIGatewayProxyResultV2> {
  const {
    moduleName,
    repository,
    ref,
    description,
    starCount,
    versionPrefix,
    subdir,
  } = options;

  if (!ref.startsWith(versionPrefix)) {
    return respondJSON({
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        info: "ignoring event as the version does not match the version prefix",
      }),
    });
  }

  const version = ref.substring(versionPrefix.length);

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

  const resp = await checkAvailable(moduleName, repository);
  if (resp) return resp;

  // Update meta information in MongoDB (registers module if not present yet)
  await database.saveModule({
    name: moduleName,
    type: "github",
    repository,
    description,
    star_count: starCount,
  });

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
  if (build !== null) {
    return respondJSON({
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        error: "this module version is already being published",
      }),
    });
  }

  const buildID = await database.createBuild({
    options: {
      type: "github",
      moduleName,
      repository,
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
        repository: repository,
        status_url: `https://deno.land/status/${buildID}`,
      },
    }),
  });
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
