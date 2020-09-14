import { assertEquals, readJson, readJsonSync } from "../test_deps.ts";
import { runBenchmarks, bench } from "https://deno.land/std/testing/bench.ts";
import { directorySize } from "./utils.ts";
import { DirectoryListingFile } from "./types.ts";

Deno.test({
  name: "directory size for deno v1.3.2",
  async fn() {
    const dir = await readJson(
      "./utils/testdata/deno-v1.3.2.json",
    ) as DirectoryListingFile[];
    assertEquals(directorySize(dir), 7206822); // check the calculation
    assertEquals(dir[0].size, 7206822); // check the list was modified in place
    assertEquals(dir[8].size, 8385); // check the list was modified in place
    console.log(dir[dir.length - 1]);
  },
});

bench(function benchDirectorySize(b) {
  const dir = readJsonSync(
    "./utils/testdata/deno-v1.3.2.json",
  ) as DirectoryListingFile[];
  b.start();
  for (let i = 0; i < 10000; i++) {
    directorySize(dir);
  }
  b.stop();
});

runBenchmarks();
