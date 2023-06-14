// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

/**
 * This function receives webhook events from GitHub. When an event is received
 * the service checks if it comes from GitHub, if the module name and repository
 * ID match up, and if this version of the module has been uploaded already. If
 * all of these checks pass a build is created in datastore and the ID of this
 * build is added to the AWS SQS build queue to be processed asynchronously.
 */

import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from "../../deps.ts";
import { parseRequestBody, respondJSON } from "../../utils/http.ts";
import { isIp4InCidrs } from "../../utils/net.ts";
import type { APIErrorResponse } from "../../utils/types.ts";

const apilandURL = Deno.env.get("APILAND_URL")!;
const apilandAuthToken = Deno.env.get("APILAND_AUTH_TOKEN")!;

export async function handler(
  event: APIGatewayProxyEventV2,
  _context: Context,
): Promise<APIGatewayProxyResultV2> {
  const ip = event.requestContext.http.sourceIp;
  if (!isGitHubHooksIP(ip)) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "request does not come from GitHub",
      } as APIErrorResponse),
    });
  }

  const moduleName = event.pathParameters?.name;
  if (!moduleName) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "no module name specified",
      } as APIErrorResponse),
    });
  }

  const headers = new Headers(event.headers as Record<string, string>);

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
      } as APIErrorResponse),
    });
  }

  // Check the GitHub event type.
  const ghEvent = headers.get("x-github-event");

  // Decode event body in the case the event is submitted as form-urlencoded
  event = parseRequestBody(event);

  const url = new URL(`${apilandURL}/temp_gh/${moduleName}`);
  if (event.queryStringParameters) {
    for (const [key, val] of Object.entries(event.queryStringParameters)) {
      url.searchParams.set(key, val ?? "");
    }
  }

  // this is temporary until apiland subsumes the functionality of registry2
  const res = await fetch(url, {
    method: "POST",
    body: event.body,
    headers: {
      "x-github-event": ghEvent ?? "",
      "authorization": `bearer ${apilandAuthToken}`,
    },
  });

  return respondJSON({
    statusCode: res.status,
    body: await res.text(),
  });
}

// From https://api.github.com/meta
const GITHUB_HOOKS_CIDRS = [
  "192.30.252.0/22",
  "185.199.108.0/22",
  "140.82.112.0/20",
  "143.55.64.0/20",
];

export function isGitHubHooksIP(ip: string): boolean {
  return isIp4InCidrs(ip, GITHUB_HOOKS_CIDRS);
}
