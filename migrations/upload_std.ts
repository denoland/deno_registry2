import { Database } from "../utils/database.ts";
import { asyncPool } from "../utils/util.ts";
import { queueBuild } from "../utils/queue.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);
const db = JSON.parse(Deno.readTextFileSync("./database.json"));

const releases = [
  "0.63.0",
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
