import { Database } from "../utils/database.ts";
import { queueBuild } from "../utils/queue.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

const databasejson = JSON.parse(Deno.readTextFileSync("./database.json"));

const data = JSON.parse(Deno.readTextFileSync("./releases.json"));

const start = 0;
const end = 100;

let i = 0;
for (const module of data) {
  if (i < start) {
    i++;
    continue;
  }
  if (module.status !== 200) {
    console.log(module.name, "status not 200");
    continue;
  }
  const releases = module.data.map((r: any) => r.name).reverse();
  (async () => {
    for (const release of releases) {
      const path: string | undefined = databasejson[module.name].path;
      console.log(module.name, release);
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

      await new Promise((r) => setTimeout(r, 2000));
    }
  })();
  i++;
  if (i > end) break;
}
