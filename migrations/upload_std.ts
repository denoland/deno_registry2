import { Database } from "../utils/database.ts";
import { asyncPool } from "../utils/util.ts";
import { queueBuild } from "../utils/queue.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);
const db = JSON.parse(Deno.readTextFileSync("./database.json"));

const releases = [
  ["30_seconds_of_typescript", "v1.0.1"],
  ["calcite", "2.1"],
  ["calcite", "2.0"],
  ["compress", "v0.3.2"],
  ["compress", "v0.3.1"],
  ["compress", "v0.3.0"],
  ["compress", "v0.2.2"],
  ["compress", "v0.2.1"],
  ["compress", "v0.2.0"],
  ["crc32", "v0.2.0"],
  ["denon", "2.3.0"],
  ["dep", "v0.2.3"],
  ["effector", "v0.18.2"],
  ["effector", "v0.18.1"],
  ["effector", "v0.18.0"],
  ["effector", "v0.18.0-rc.2"],
  ["effector", "v0.18.0-beta.11"],
  ["effector", "v0.18.0-beta.10"],
  ["effector", "v0.17.6"],
  ["effector", "v0.17.4"],
];

await asyncPool(50, releases, async (release) => {
  const module = db[release[0]];

  const buildID = await database.createBuild({
    options: {
      type: "github",
      moduleName: release[0],
      repository: module.owner + "/" + module.repo,
      ref: release[1],
      version: release[1],
      subdir: module.path ? module.path.substring(1) + "/" : undefined,
    },
    status: "queued",
  });
  await queueBuild(buildID);
});
