// Copyright 2020 the Deno authors. All rights reserved. MIT license.

/**
 * This function returns statistics about recently uploaded modules, versions, ect.
 * The function is triggered by a HTTP GET call to /stats.
 */

import type {
  APIGatewayProxyEventV2,
  Context,
  APIGatewayProxyResultV2,
} from "../deps.ts";
import { respondJSON } from "../utils/http.ts";
import { Database } from "../utils/database.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyResultV2> {
  const total_count = await database.countModules();
  const recently_added_modules = await database.listRecentlyAddedModules();
  const recently_uploaded_versions = await database
    .listRecentlyUploadedVersions();

  return respondJSON({
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: {
        total_count,
        recently_added_modules,
        recently_uploaded_versions,
      },
    }),
  });
}
