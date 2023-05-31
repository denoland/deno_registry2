// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

/**
 * This function is responsible for returning a single module stored in
 * the database by name. The function is triggered by a HTTP GET call
 * to /modules/{name}. More information in API.md.
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from "../../deps.ts";
import { respondJSON } from "../../utils/http.ts";
import type {
  APIErrorResponse,
  APIModuleGetResponse,
} from "../../utils/types.ts";
import { Database as Datastore } from "../../utils/datastore_database.ts";

const datastore = new Datastore();

export async function handler(
  event: APIGatewayProxyEventV2,
  _context: Context,
): Promise<APIGatewayProxyResultV2> {
  const name = event.pathParameters?.name || undefined;

  if (!name) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "no module name specified",
      } as APIErrorResponse),
    });
  }

  const module = await datastore.getModule(name);

  if (module === null) {
    return respondJSON(
      {
        statusCode: 404,
        body: JSON.stringify(
          { success: false, error: "module not found" } as APIErrorResponse,
        ),
      },
    );
  }

  return respondJSON({
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: {
        name: module.name,
        description: module.description,
        star_count: module.star_count,
      },
    } as APIModuleGetResponse),
  });
}
