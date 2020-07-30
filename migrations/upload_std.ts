import { Database } from "../utils/database.ts";
import { asyncPool } from "../utils/util.ts";
import { queueBuild } from "../utils/queue.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);
const db = JSON.parse(Deno.readTextFileSync("./database.json"));

const releases = [
  "0.62.0",
  "0.61.0",
  "0.60.0",
  "0.59.0",
  "0.58.0",
  "0.57.0",
  "0.56.0",
  "0.55.0",
  "0.54.0",
  "0.53.0",
  "0.52.0",
  "0.51.0",
  "0.50.0",
  "0.42.0",
  "0.41.0",
  "0.40.0",
  "0.39.0",
  "0.38.0",
  "0.37.0",
  "0.36.0",
  "0.35.0",
  "0.34.0",
].map(d => ["std", d]);

await asyncPool(4, releases, async (release) => {
  const module = db[release[0]];

  const buildID = await database.createBuild({
    options: {
      type: "github",
      moduleName: release[0],
      repository: module.owner + "/" + module.repo,
      ref: "std/"+release[1],
      version: release[1],
      subdir: module.path ? module.path.substring(1) + "/" : undefined,
    },
    status: "queued",
  });
  await queueBuild(buildID);
});
