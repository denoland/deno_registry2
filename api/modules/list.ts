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
  ListModuleResult,
  SearchOptions,
  SearchResult,
  Sort,
  SortValues,
} from "../../utils/database.ts";
import type { ScoredModule } from "../../utils/database.ts";
import type {
  APIErrorResponse,
  APIModuleListResponseSuccess,
  APIModuleListShortResponse,
} from "../../utils/types.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

const deprecate = {
  "X-Deprecate":
    "The search functionality ('query' parameter) of this API will be removed on May 1st 2021. Starting on April 1st 5% of all requests to this endpoint that include the 'query' search parameter will fail. During the month of April you can prevent this brownout by setting a `X-Ack-Deprecate` header on your request.",
};

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyResultV2> {
  const simple = event.queryStringParameters?.simple === "1";
  if (simple) {
    const results = await database.listAllModuleNames();
    return respondJSON({
      statusCode: 200,
      body: JSON.stringify(results as APIModuleListShortResponse),
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
      } as APIErrorResponse),
      headers: query ? deprecate : undefined,
    });
  }

  if (page < 1) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "the page number must not be lower than 1",
      } as APIErrorResponse),
      headers: query ? deprecate : undefined,
    });
  }

  const publicSort = SortValues.filter((s) => s !== "search_order");
  if (sort !== undefined && !publicSort.includes(sort)) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: `the sort order must be one of ${publicSort.join(", ")}`,
      } as APIErrorResponse),
      headers: query ? deprecate : undefined,
    });
  }

  const [searchResult, count] = await Promise.all([
    database.listModules({ limit, page, query, sort: sort as Sort }).then(
      (results: ListModuleResult): [SearchOptions, SearchResult[]] => {
        // Transform the results
        const options = results[0];
        const mods = results[1].map((doc: ScoredModule): SearchResult => ({
          name: doc._id,
          description: doc.description,
          star_count: doc.star_count,
          search_score: doc.search_score,
        }));
        return [options, mods];
      },
    ),
    database.countModules(),
  ]);

  const [options, results] = searchResult;

  return respondJSON({
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: { total_count: count, options, results },
      headers: query ? deprecate : undefined,
    } as APIModuleListResponseSuccess),
  });
}
