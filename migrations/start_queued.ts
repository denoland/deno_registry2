import { Database } from "../utils/database.ts";
import { queueBuild } from "../utils/queue.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

const builds = await database._builds.find(
  { "status": "publishing" },
);

console.log(builds);

await Promise.all(builds.map((b) => queueBuild(b._id.$oid)));
