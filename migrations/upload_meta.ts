import { Database } from "../utils/database.ts";
import { uploadMetaJson } from "../utils/storage.ts";
import { asyncPool } from "../utils/util.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

// const releases = JSON.parse(Deno.readTextFileSync("./releases.json"));
// const meta = JSON.parse(Deno.readTextFileSync("./meta.json"));

// let i = 0;

// asyncPool(50, meta, async (module: any) => {
//   const release = releases.filter((d: any) => d.name === module.name)[0];
//   console.log(i, module.name);
//   if (release?.status !== 200) {
//     console.log(module.name, "status not 200");
//     return;
//   }
//   i++;

//   await database.saveModule({
//     name: module.name,
//     description: module.data.description,
//     repository: module.repository,
//     type: "github",
//     star_count: module.data.stargazers_count,
//   });

//   const versions = release.data;
//   await uploadMetaJson(
//     module.name,
//     "/versions.json",
//     {
//       latest: versions.length === 0 ? null : versions[0].name,
//       versions: versions.map((d: any) => d.name),
//       isLegacy: versions.length === 0 ? true : undefined,
//     },
//   );
// });

await uploadMetaJson(
  "std",
  "/versions.json",
  {
    latest: "0.62.0",
    versions: [
      "0.62.0",
      "0.61.0",
      "0.60.0",
      "0.59.0",
      "0.58.0",
      "0.57.0",
      "0.56.0",
      "0.55.0",
      "0.54.0",
      "0.53.0",
      "0.52.0",
      "0.51.0",
      "0.50.0",
      "0.42.0",
      "0.41.0",
      "0.40.0",
      "0.39.0",
      "0.38.0",
      "0.37.0",
      "0.36.0",
      "0.35.0",
      "0.34.0",
    ],
  },
);
