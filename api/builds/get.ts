// Copyright 2020 the Deno authors. All rights reserved. MIT license.

/**
 * This function gets a build from the database by id. The function is triggered
 *  by a HTTP GET call to /builds/{id}.
 */

import {
  APIGatewayProxyEventV2,
  Context,
  APIGatewayProxyResultV2,
} from "../../deps.ts";
import { respondJSON } from "../../utils/http.ts";
import { getBuild } from "../../utils/database.ts";

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyResultV2> {
  const id = event.pathParameters?.id;

  if (!id) {
    return respondJSON({
      statusCode: 400,
      body: JSON.stringify({ success: false, error: "no build id provided" }),
    });
  }

  const build = await getBuild(id);

  if (build === null) {
    return respondJSON({
      statusCode: 404,
      body: JSON.stringify({ success: false, error: "build not found" }),
    });
  }

  return respondJSON({
    statusCode: 200,
    body: JSON.stringify({ success: true, data: { build } }),
  });
}
