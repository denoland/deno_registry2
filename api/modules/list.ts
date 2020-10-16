// Copyright 2020 the Deno authors. All rights reserved. MIT license.

/**
 * This function is responsible for listing the modules stored in the
 * database. It can be filtered with a search query and is paginated.
 * The function is triggered by a HTTP GET call to /modules. More
 * information in API.md.
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from "../../deps.ts";
import { respondJSON } from "../../utils/http.ts";
import {
  Database,
  SearchResult,
  Sort,
  SortValues,
} from "../../utils/database.ts";
import type { ScoredModule } from "../../utils/database.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyResultV2> {
  const simple = event.queryStringParameters?.simple === "1";
  if (simple) {
    const results = await database.listAllModuleNames();
    return respondJSON({
      statusCode: 200,
      body: JSON.stringify(results),
      headers: {
        "cache-control": "max-age=60, must-revalidate",
      },
    });
  }

  const limit = parseInt(event.queryStringParameters?.limit || "20");
  const page = parseInt(event.queryStringParameters?.page || "1");
  const query = event.queryStringParameters?.query || undefined;
  const sort = event.queryStringParameters?.sort || undefined;

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

  if (sort !== undefined && !SortValues.includes(sort)) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: `the sort order must be one of ${SortValues.join(", ")}`,
      }),
    });
  }

  const [results, count] = await Promise.all([
    database.listModules({ limit, page, query, sort: sort as Sort }).then(
      (results: ScoredModule[]): SearchResult[] => {
        // Transform the results
        return results.map((doc: ScoredModule) => ({
          name: doc._id,
          description: doc.description,
          star_count: doc.star_count,
          search_score: doc.search_score,
        }));
      },
    ),
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
