// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyStructuredResultV2,
  decodeqs,
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
    event.body = decodeqs(atob(event.body)).payload as string ?? undefined;
  }
  return event;
}
