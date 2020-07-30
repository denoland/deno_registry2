import { Database } from "../utils/database.ts";
import { queueBuild } from "../utils/queue.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

for (let i = 0; i < 30; i++) {
  const builds = await database._builds.find(
    {status: {$not:{$eq: "success"}}},
    { limit: 2 },
    // { "stats.skipped_due_to_size": { $exists: true, $not: { $size: 0 } } } as any,
  );
  console.log(builds);
  await Promise.all(builds.map((b: any) => queueBuild(b._id.$oid)));
  await new Promise((r) => setTimeout(r, 1250));
}
