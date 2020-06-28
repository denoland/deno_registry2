// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import { APIGatewayProxyResult } from "../deps.ts";

export function respondJSON(
  result: APIGatewayProxyResult,
): APIGatewayProxyResult {
  return {
    ...result,
    headers: {
      "content-type": "application/json",
      ...result.headers,
    },
  };
}
