import { assertEquals, bench, runBenchmarks } from "../test_deps.ts";
import { directorySize } from "./utils.ts";
import type { DirectoryListingFile } from "./types.ts";

Deno.test({
  name: "directory size for deno v1.3.2",
  async fn() {
    const dir = JSON.parse(
      await Deno.readTextFile(
        "./utils/testdata/deno-v1.3.2.json",
      ),
    ) as DirectoryListingFile[];
    assertEquals(directorySize(dir), 7206822); // check the calculation
    assertEquals(dir[0].size, 7206822); // check the list was modified in place
    assertEquals(dir[8].size, 8385); // check the list was modified in place
    console.log(dir[dir.length - 1]);
  },
});

bench(function benchDirectorySize(b) {
  const dir = JSON.parse(
    Deno.readTextFileSync(
      "./utils/testdata/deno-v1.3.2.json",
    ),
  ) as DirectoryListingFile[];
  b.start();
  for (let i = 0; i < 10000; i++) {
    directorySize(dir);
  }
  b.stop();
});

runBenchmarks();
