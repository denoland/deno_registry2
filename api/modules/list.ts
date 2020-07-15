// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import {
  APIGatewayProxyEventV2,
  Context,
  APIGatewayProxyResultV2,
} from "../../deps.ts";
import { respondJSON } from "../../utils/http.ts";
import { listEntries, countEntries } from "../../utils/database.ts";

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> {
  // TODO(lucacasonato): gracefully handle errors

  const limit = parseInt(event.queryStringParameters?.limit || "20");
  const page = parseInt(event.queryStringParameters?.page || "1");
  const query = event.queryStringParameters?.query || undefined;

  const [results, count] = await Promise.all([
    listEntries(limit, page, query),
    countEntries(),
  ]);

  return respondJSON({
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: {
        total_count: count,
        results,
      },
    }),
  });
}
