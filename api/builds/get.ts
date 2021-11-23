// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

/**
 * This function gets a build from the database by id. The function is triggered
 *  by a HTTP GET call to /builds/{id}.
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from "../../deps.ts";
import { Bson } from "../../deps.ts";
import { respondJSON } from "../../utils/http.ts";
import { Database } from "../../utils/database.ts";
import type {
  APIBuildGetResponseSuccess,
  APIErrorResponse,
} from "../../utils/types.ts";

const database = await Database.connect(Deno.env.get("MONGO_URI")!);

export async function handler(
  event: APIGatewayProxyEventV2,
  _context: Context,
): Promise<APIGatewayProxyResultV2> {
  const id = event.pathParameters?.id;

  if (!id) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify(
        { success: false, error: "no build id provided" } as APIErrorResponse,
      ),
    });
  }

  try {
    new Bson.ObjectId(id);
  } catch (_err: unknown) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify(
        { success: false, error: "invalid build id" } as APIErrorResponse,
      ),
    });
  }

  const build = await database.getBuild(id);

  if (build === null) {
    return respondJSON({
      statusCode: 404,
      body: JSON.stringify(
        { success: false, error: "build not found" } as APIErrorResponse,
      ),
    });
  }

  return respondJSON({
    statusCode: 200,
    body: JSON.stringify(
      { success: true, data: { build } } as APIBuildGetResponseSuccess,
    ),
  });
}
