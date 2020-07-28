import { Database } from "../utils/database.ts";
import { uploadMeta, uploadVersionMeta } from "../utils/storage.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

const releases = JSON.parse(Deno.readTextFileSync("./releases.json"));
const meta = JSON.parse(Deno.readTextFileSync("./meta.json"));

const encoder = new TextEncoder();

let i = 0;
for (const module of meta) {
  const release = releases.filter((d: any) => d.name === module.name)[0];
  console.log(i, module.name);
  if (release?.status !== 200) {
    console.log(module.name, "status not 200");
    continue;
  }
  i++;

  // await database.saveModule({
  //   name: module.name,
  //   description: module.data.description,
  //   repository: module.repository,
  //   type: "github",
  //   star_count: module.data.stargazers_count,
  // });

  const versions = release.data;
  await uploadMeta(
    module.name,
    "/versions.json",
    encoder.encode(JSON.stringify({
      latest: versions.length === 0 ? null : versions[0].name,
      versions: versions.map((d: any) => d.name),
      isLegacy: versions.length === 0 ? true : undefined,
    })),
  );
}
