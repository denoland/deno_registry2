import { directorySize } from "./utils.ts";
import type { DirectoryListingFile } from "./types.ts";

const dir = JSON.parse(Deno.readTextFileSync(
  "./utils/testdata/deno-v1.3.2.json",
)) as DirectoryListingFile[];

Deno.bench(function benchDirectorySize() {
  directorySize(dir);
});
