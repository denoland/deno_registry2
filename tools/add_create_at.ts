import { pooledMap } from "../deps.ts";
import { Database } from "../utils/database.ts";
import { getMeta, getVersionMetaJson } from "../utils/storage.ts";
const database = new Database(Deno.env.get("MONGO_URI")!);

const modules = await database._modules.find({});

await Deno.writeTextFile(
  "modules_backup_" + (new Date()).toISOString() + ".json",
  JSON.stringify(modules),
);

const latests = pooledMap(50, modules, async (module) => {
  const raw = await getMeta(module._id, "versions.json");
  if (!raw) return [module._id, undefined];
  const data = JSON.parse(new TextDecoder().decode(raw));
  return [module._id, data.latest ?? undefined];
});

const now = new Date();

const createdAt = pooledMap(50, latests, async (m) => {
  const name = m[0];
  const latest = m[1];
  let created_at = now;

  if (latest) {
    const raw = await getVersionMetaJson(name, latest, "meta.json");
    if (raw) {
      const data = JSON.parse(new TextDecoder().decode(raw));
      created_at = new Date(data.uploaded_at);
    }
  }

  console.log(name, created_at);

  return [name, created_at];
});

for await (const m of createdAt) {
  await database._modules.updateOne({ _id: m[0] }, {
    "$set": {
      created_at: m[1],
    },
  });
  console.log("updated", m[0]);
}

console.log(">>>> TOTAL: ", modules.length);
