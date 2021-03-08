// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.
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
  },
});

Deno.test({
  name: "different directories with the same prefix",
  fn() {
    const mock: DirectoryListingFile[] = [
      {
        path: "",
        type: "dir",
        size: undefined,
      },
      {
        path: "foo",
        type: "dir",
        size: undefined,
      },
      {
        path: "foo/bar",
        type: "dir",
        size: undefined,
      },
      {
        path: "foobar",
        type: "dir",
        size: undefined,
      },
      {
        path: "foobarbaz",
        type: "dir",
        size: undefined,
      },
      {
        path: "foo/foo.ts",
        size: 100,
        type: "file",
      },
      {
        path: "foo/bar/bar.ts",
        type: "file",
        size: 100,
      },
      {
        path: "foobar/bar.ts",
        size: 100,
        type: "file",
      },
      {
        path: "foobarbaz/baz.ts",
        size: 100,
        type: "file",
      },
    ];

    assertEquals(directorySize(mock), 400);
    // the first item should match the output of the function
    assertEquals(mock[0].size, 400);
    // the directory "foo" shouldn't count the contents of "foobar" and
    // "foobarbaz" in its total
    assertEquals(mock[1].size, 200);
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
