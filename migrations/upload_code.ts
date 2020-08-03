import { Database } from "../utils/database.ts";
import { queueBuild } from "../utils/queue.ts";
import { asyncPool } from "../utils/util.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

const databasejson = JSON.parse(Deno.readTextFileSync("./database.json"));

const data = JSON.parse(Deno.readTextFileSync("./releases.json"));

// const start = 701;
// const end = 800;

const todo = [
  ["abc", "v1.0.2"],
  ["ask", "1.0.5"],
  ["base64", "v0.2.1"],
  ["bcrypt", "v0.2.4"],
  ["bwt", "v0.6.0"],
  ["bytes_formater", "v1.3.0"],
  ["cliffy", "v0.12.0"],
  ["compress", "v0.3.3"],
  ["cotton", "v0.6.3"],
  ["deno", "v1.2.2"],
  ["djwt", "v1.2"],
  ["dnit", "dnit-v1.1.1"],
  ["dnit", "dnit-v1.1.0"],
  ["doa", "v1.0.0"],
  ["drake", "v1.2.6"],
  ["drash", "v1.2.1"],
  ["drash_middleware", "v0.3.0"],
  ["evt", "1.8.3"],
  ["evt", "1.8.2"],
].map(([name, release]) => ([data.find((d: any) => d.name === name), release]));

let i2 = 0;

await asyncPool(6, todo, async ([module, release]) => {
  i2++;
  const path: string | undefined = databasejson[module.name].path;
  console.log(`${i2}/${todo.length}`, module.name, release);
  const buildID = await database.createBuild({
    options: {
      type: "github",
      moduleName: module.name,
      repository: module.repository,
      ref: release,
      version: release,
      subdir: path ? path.substring(1) + "/" : undefined,
    },
    status: "queued",
  });
  await queueBuild(buildID);
  await new Promise((r) => setTimeout(r, 1500));
});
