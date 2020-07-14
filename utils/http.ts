// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import { APIGatewayProxyResultV2, APIGatewayProxyStructuredResultV2 } from "../deps.ts";

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
