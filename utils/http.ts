// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyStructuredResultV2,
} from "../deps.ts";

export function respondJSON(
  result: APIGatewayProxyStructuredResultV2,
): APIGatewayProxyResultV2 {
  return {
    ...result,
    headers: {
      "content-type": "application/json",
      ...result.headers,
    },
  };
}

export function parseRequestBody(
  event: APIGatewayProxyEventV2,
): APIGatewayProxyEventV2 {
  if (event.isBase64Encoded && event.body) {
    event.body = atob(event.body);
    event.isBase64Encoded = false;
  }

  const headers = new Headers(event.headers);
  if (
    headers.get("content-type") === "application/x-www-form-urlencoded" &&
    event.body
  ) {
    event.body = new URLSearchParams(event.body).get("payload") ?? undefined;
  }
  return event;
}
