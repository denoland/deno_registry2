// Copyright 2020 the Deno authors. All rights reserved. MIT license.

/**
 * This function is responsible for cleaning up unused module names from the
 * database. Modules are cleaned up when they have been registered for over 30
 * days but still have no published versions. Modules with published versions
 * are never cleaned up, no matter how long they've been inactive for.
 */

import type { Context, ScheduledEvent } from "../../deps.ts";
import { Database } from "../../utils/database.ts";

const database = await Database.connect(Deno.env.get("MONGO_URI")!);
const INACTIVITY_PERIOD = 1000 * 60 * 60 * 24 * 30; // 30 days

export async function handler(
  _: ScheduledEvent,
  __: Context,
): Promise<void> {
  const DRYRUN = Deno.env.get("DRYRUN") ?? "1";
  if (DRYRUN) console.log("starting in dryrun mode.");
  const modules = await database.listAllModules();
  const now = new Date();
  for (const module of modules.filter((m) => m.is_unlisted === false)) {
    const successfulBuilds = await database.listSuccessfulBuilds(module.name);
    console.log(successfulBuilds);
    if (
      successfulBuilds.length === 0 &&
      Math.abs(now.getTime() - module.created_at.getTime()) >= INACTIVITY_PERIOD
    ) {
      console.log(
        `Deleting module [ ${module.name} ] created on [ ${module.created_at} ] due to inactivity.`,
      );

      if (!DRYRUN) {
        await database.deleteModule(module.name);
      }
    }
  }
}
