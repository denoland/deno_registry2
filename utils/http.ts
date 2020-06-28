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
