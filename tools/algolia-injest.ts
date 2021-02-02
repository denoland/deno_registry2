import { Database } from "../utils/database.ts";
import { AlgoliaAPI, SearchModule } from "../utils/algolia.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

const modules = await database.listAllModules();

const modulesForSearch = modules.filter((module) => !module.is_unlisted).map<
  SearchModule
>((module) => ({
  objectID: module.name,
  name: module.name,
  description: module.description,
  owner: module.owner,
  repo: module.repo,
  starCount: module.star_count ?? 0,
  createdAt: module.created_at,
  updatedAt: new Date(),
}));

const algolia = new AlgoliaAPI(
  Deno.env.get("ALGOLIA_APPLICATION_ID")!,
  Deno.env.get("ALGOLIA_API_KEY")!,
);

const res = await algolia.saveModules(modulesForSearch);

console.log(res);
