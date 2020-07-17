// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import {
  APIGatewayProxyEventV2,
  Context,
  APIGatewayProxyResultV2,
} from "../../deps.ts";
import { respondJSON } from "../../utils/http.ts";
import { getModule, saveModule, createBuild } from "../../utils/database.ts";
import { getMeta } from "../../utils/storage.ts";
import type { WebhookPayloadCreate } from "../../utils/webhooks.d.ts";
import { isIp4InCidrs } from "../../utils/net.ts";
import { queueBuild } from "../../utils/queue.ts";
import type { VersionInfo } from "../../utils/types.ts";

const VALID_NAME = /[A-Za-z0-9_]{1,40}/;

const decoder = new TextDecoder();

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
  if (!moduleName || !VALID_NAME.test(moduleName)) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "module name is not valid",
      }),
    });
  }

  const headers = new Headers(event.headers);

  // Check that event is a GitHub `create` event.
  const ghEvent = headers.get("x-github-event");
  if (ghEvent !== "create") {
    return respondJSON({
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        info: "not a create event",
      }),
    });
  }

  // Get version, version type, and repository from event
  if (!(headers.get("content-type") ?? "").startsWith("application/json")) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "content-type is not json",
      }),
    });
  }
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

  const versionPrefix =
    decodeURIComponent(event.queryStringParameters?.version_prefix ?? "") ||
    null;

  if (!ref.startsWith(versionPrefix)) {
    return respondJSON({
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        info: "ignoring event as the version does not match the version prefix",
      }),
    });
  }

  const version = versionPrefix === null
    ? ref
    : ref.substring(versionPrefix.length);

  const subdir =
    decodeURIComponent(event.queryStringParameters?.subdir ?? "") || null;
  if (subdir !== null) {
    if (subdir.startsWith("/")) {
      return respondJSON({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          info: "provided sub directory is not valid as it starts with a /",
        }),
      });
    } else if (!subdir.endsWith("/")) {
      return respondJSON({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          info:
            "provided sub directory is not valid as it does not end with a /",
        }),
      });
    }
  }

  const entry = await getModule(moduleName);
  if (entry) {
    // Check that entry matches repo
    if (!(entry.type === "github" && entry.repository === repository)) {
      return respondJSON({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "module name is registered to a different repository",
        }),
      });
    }
  }

  // Update meta information in MongoDB (registers module if not present yet)
  await saveModule({
    name: moduleName,
    type: "github",
    repository,
    description: webhook.repository.description,
    star_count: webhook.repository.stargazers_count,
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

  // TODO(lucacasonato): Check that a build has not already been queued

  const buildID = await createBuild({
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
        status_url: `https://deno.land/x/-/status/${buildID}`,
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
