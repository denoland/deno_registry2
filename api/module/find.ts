// Copyright 2020 the Deno authors. All rights reserved. MIT license.

/**
 * This function is responsible for retrieving a particular module stored in the
 * database. It can be queried with a search query.
 * The function is triggered by a HTTP GET call to /module. More
 * information in API.md. 
 */

import {
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
  // TODO(@divy-work, @lucacasonato): Handle errors.
  const query = event.queryStringParameters?.query;

  if (!query) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "no module name provided",
      }),
    });
  }

  const results = await database.getModule(query);

  if (!results) {
    return respondJSON({
      statusCode: 404,
      body: JSON.stringify({
        success: false,
        error: "module does not exist",
      }),
    });
  }

  return respondJSON({
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: { results },
    }),
  });
}
