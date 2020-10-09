import { assert } from "https://deno.land/std@0.73.0/testing/asserts.ts";
import { pooledMap } from "https://deno.land/std@0.73.0/async/pool.ts";
import { Database } from "../utils/database.ts";

const db = new Database(Deno.env.get("MONGO_URI") ?? "");
const GH_TOKEN = Deno.env.get("GH_TOKEN");
assert(GH_TOKEN);

const all = await db._modules.find({});

await Deno.writeTextFile(
  `./backup-${new Date().toISOString()}.json`,
  JSON.stringify(all),
);

pooledMap(10, all, async (mod) => {
  try {
    const gh = await fetch(
      `https://api.github.com/repos/${mod.owner}/${mod.repo}`,
      { headers: { Authorization: `Bearer ${GH_TOKEN}` } },
    )
      .then(async (res) => {
        if (res.status === 200) {
          return res.json();
        }
        throw new Error(`Failed ${mod._id}: ${await res.text()}`);
      });
    mod.repo_id = gh.id!;
    await db._modules.updateOne(
      // deno-lint-ignore no-explicit-any
      { _id: mod._id as any },
      // deno-lint-ignore no-explicit-any
      mod as any,
      { upsert: true },
    );
  } catch (err) {
    console.log("%cfailed for " + mod._id, "color: red");
  }
  console.log("%cdone " + mod._id, "color: green");
});
