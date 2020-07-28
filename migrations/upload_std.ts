// import { Database } from "../utils/database.ts";
// import { asyncPool } from "../utils/util.ts";
// import { queueBuild } from "../utils/queue.ts";
import { uploadMetaJson } from "../utils/storage.ts";

// const database = new Database(Deno.env.get("MONGO_URI")!);

const versions = [
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
];

await uploadMetaJson("std", "versions.json", {
  latest: "0.62.0",
  versions,
});

// await asyncPool(50, versions, async (version) => {
//   const buildID = await database.createBuild({
//     options: {
//       type: "github",
//       moduleName: "std",
//       repository: "denoland/deno",
//       ref: "std/" + version,
//       version,
//       subdir: "std/",
//     },
//     status: "queued",
//   });
//   await queueBuild(buildID);
// });
