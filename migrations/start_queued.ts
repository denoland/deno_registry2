import { Database } from "../utils/database.ts";
import { queueBuild } from "../utils/queue.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);
const builds = await database._builds.find(
  { status: "error", message: "Failed to put object: 503 Service Unavailable" },
  { limit: 3 },
  // { "stats.skipped_due_to_size": { $exists: true, $not: { $size: 0 } } } as any,
);

console.log(builds);

await Promise.all(builds.map((b: any) => queueBuild(b._id.$oid)));
