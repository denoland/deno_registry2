// Copyright 2020 the Deno authors. All rights reserved. MIT license.

/**
 * This function is responsible for listing the modules stored in the
 * database. It can be filtered with a search query and is paginated.
 * The function is triggered by a HTTP GET call to /modules. More
 * information in API.md. 
 */

import type {
  APIGatewayProxyEventV2,
  Context,
  APIGatewayProxyResultV2,
} from "../../deps.ts";
import { respondJSON } from "../../utils/http.ts";
import { Database } from "../../utils/database.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyResultV2> {
  const limit = parseInt(event.queryStringParameters?.limit || "20");
  const page = parseInt(event.queryStringParameters?.page || "1");
  const query = event.queryStringParameters?.query || undefined;

  if (limit > 100 || limit < 1) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "the limit may not be larger than 100 or smaller than 1",
      }),
    });
  }

  if (page < 1) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "the page number must not be lower than 1",
      }),
    });
  }

  const [results, count] = await Promise.all([
    database.listModules(limit, page, query),
    database.countModules(),
  ]);

  return respondJSON({
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: { total_count: count, results },
    }),
  });
}
