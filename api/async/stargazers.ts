// Copyright 2020 the Deno authors. All rights reserved. MIT license.

/**
 * This function is responsible for updating the number of stargazers for each
 * module once a day by scraping the github API. This process is handled by a
 * CloudWatch Event on a cron schedule set to trigger once every day.
 */

import type { ScheduledEvent, Context } from "../../deps.ts";
import { SSM } from "../../deps.ts";
import type { ScoredModule, SearchResult } from "../../utils/database.ts";
import { Database, Module } from "../../utils/database.ts";
import { GitHub, GitHubAuth } from "../../utils/github.ts";

// Declaring outside of the handler so they can be cached between invocations.
const ssm = new SSM({
  region: Deno.env.get("AWS_REGION")!,
  accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  sessionToken: Deno.env.get("AWS_SESSION_TOKEN")!,
  endpointURL: Deno.env.get("SSM_ENDPOINT_URL")!,
});
const secret = await ssm.getParameter({
  Name: Deno.env.get("GITHUB_TOKEN_SSM") ?? "",
  WithDecryption: true,
});

const API_TOKEN = secret?.Parameter?.Value;
const API_USER = Deno.env.get("GITHUB_USERNAME") ?? "";
const auth: GitHubAuth | undefined = secret
  ? { username: API_USER as string, token: API_TOKEN as string }
  : undefined;

const gh = new GitHub(auth);
const database = new Database(Deno.env.get("MONGO_URI")!);

export async function handler(
  _: ScheduledEvent,
  __: Context,
): Promise<void> {
  const modules = await database.listAllModules();
  for (let mod of modules) {
    try {
      const repo = await (await gh.getRepo(mod.owner, mod.repo)).json();
      if (repo.stargazers_count !== mod.star_count) {
        mod.star_count = repo.stargazers_count;
        await database.saveModule(mod as unknown as Module);
      }
    } catch (err) {
      console.log(`failed to fetch repo from github api: ${err}`);
    }
  }
}
