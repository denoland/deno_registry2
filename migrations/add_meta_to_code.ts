import { s3, getVersionMeta } from "../utils/storage.ts";
import { asyncPool } from "../utils/util.ts";
import { DirectoryListingFile } from "../utils/types.ts";
import { join } from "../deps.ts";
import { lookup } from "https://deno.land/x/media_types/mod.ts";

const data = JSON.parse(Deno.readTextFileSync("./releases.json"));
const start = 0;
const end = 800;

await asyncPool(80, data, async (module: any) => {
  if (module.status !== 200) {
    console.log(module.name, "status not 200");
    return;
  }

  await s3.copyObject(
    join(module.name, "meta", "versions.json"),
    join(module.name, "meta", "versions.json"),
    {
      metadataDirective: "REPLACE",
      acl: "public-read",
      // Global module meta data must always be fresh, but it is acceptable
      // to serve stale data for a few minutes.
      cacheControl: "max-age=0, stale-while-revalidate=300",
      contentType: "application/json",
    },
  ).catch((e) => console.log(module, "failed with err", e));
});

// const versions: Array<[string, string]> = [];

// let i = 0;
// for (const module of data) {
//   if (i < start) {
//     i++;
//     continue;
//   }
//   if (module.status !== 200) {
//     console.log(module.name, "status not 200");
//     continue;
//   }

//   for (const release of module.data.map((r: any) => r.name)) {
//     versions.push([module.name, release]);
//   }

//   i++;
//   if (i > end) break;
// }

// console.log(versions);
// let i2 = 0;
// await asyncPool(80, versions, async ([module, release]) => {
//   if ((i2 % 25) === 0) console.log(i2, "/", versions.length);
//   i2++;
//   await s3.copyObject(
//     join(module, "versions", release, "meta", "meta.json"),
//     join(module, "versions", release, "meta", "meta.json"),
//     {
//       metadataDirective: "REPLACE",
//       acl: "public-read",
//       // Versioned files can be cached indefinitely. (1 year)
//       cacheControl: "public, max-age=31536000, immutable",
//       contentType: "application/json",
//     },
//   ).catch((e) => console.log(module, release, "failed with err", e));

// const metaFile = await getVersionMeta(module, release, "meta.json");
// if (metaFile === undefined) {
//   console.log("missing meta for", module, release);
//   return;
// }
// const directory = JSON.parse(decoder.decode(metaFile)).directory_listing;

// directory.forEach((item: DirectoryListingFile) => {
//   if (item.type === "file") {
//     files.push([module, release, item.path]);
//   }
// });
// });

// console.log(files.length);

// let i2 = 0;
// await asyncPool(80, files, async ([module, release, file]) => {
//   if ((i2 % 25) === 0) console.log(i2, "/", files.length);
//   i2++;
//   const type = lookup(file);
//   await s3.copyObject(
//     join(module, "versions", release, "raw", file),
//     join(module, "versions", release, "raw", file),
//     {
//       metadataDirective: "REPLACE",
//       acl: "public-read",
//       // Versioned files can be cached indefinitely. (1 year)
//       cacheControl: "public, max-age=31536000, immutable",
//       contentType: type === "video/mp2t" ? "application/typescript" : type,
//     },
//   ).catch((e) => console.log(module, release, file, "failed with err", e));
// });
