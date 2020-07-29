import { Database } from "../utils/database.ts";
import { queueBuild } from "../utils/queue.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

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

for (const [module, version] of releases) {
  const builds = await database._builds.find(
    { "options.moduleName": module, "options.version": version } as any,
  );

  console.log(builds);

  await Promise.all(builds.map((b: any) => queueBuild(b._id.$oid)));
}
