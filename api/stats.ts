// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

/**
 * This function returns statistics about recently uploaded modules, versions, ect.
 * The function is triggered by a HTTP GET call to /stats.
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from "../deps.ts";
import { respondJSON } from "../utils/http.ts";
import { Database } from "../utils/database.ts";
import type { APIStatsResponse } from "../utils/types.ts";

const database = await Database.connect(Deno.env.get("MONGO_URI")!);

export async function handler(
  _event: APIGatewayProxyEventV2,
  _context: Context,
): Promise<APIGatewayProxyResultV2> {
  const totalCount = await database.countModules();
  const totalVersions = await database.countAllVersions();
  const recentlyAddedModules = await database.listRecentlyAddedModules();
  const recentlyUploadedVersions = await database
    .listRecentlyUploadedVersions();

  return respondJSON({
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: {
        total_count: totalCount,
        total_versions: totalVersions,
        recently_added_modules: recentlyAddedModules,
        recently_uploaded_versions: recentlyUploadedVersions,
      },
    } as APIStatsResponse),
  });
}
