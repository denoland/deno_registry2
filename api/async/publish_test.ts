import { handler } from "./publish.ts";
import {
  createContext,
  createSQSEvent,
} from "../../utils/test_utils.ts";
import { assertEquals } from "../../test_deps.ts";
import { Database } from "../../utils/database.ts";
import { s3 } from "../../utils/storage.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

const decoder = new TextDecoder();

Deno.test({
  name: "publish success",
  async fn() {
    const id = await database.createBuild({
      options: {
        moduleName: "ltest",
        ref: "0.0.9",
        repository: "luca-rand/testing",
        type: "github",
        version: "0.0.9",
      },
      status: "queued",
    });

    await handler(
      createSQSEvent({ buildID: id }),
      createContext(),
    );

    assertEquals({ ...await database.getBuild(id), created_at: undefined }, {
      created_at: undefined,
      id,
      options: {
        moduleName: "ltest",
        ref: "0.0.9",
        repository: "luca-rand/testing",
        type: "github",
        version: "0.0.9",
      },
      status: "success",
      message: "Published module.",
      stats: {
        skipped_due_to_size: [],
        total_files: 11,
        total_size: 2735,
      },
    });

    // Check that versions.json file exists
    let versions = await s3.getObject("ltest/meta/versions.json");
    assertEquals(versions?.cacheControl, "max-age=10, must-revalidate");
    assertEquals(versions?.contentType, "application/json");
    assertEquals(
      JSON.parse(decoder.decode(versions?.body)),
      { latest: "0.0.9", versions: ["0.0.9"] },
    );

    let meta = await s3.getObject("ltest/versions/0.0.9/meta/meta.json");
    assertEquals(meta?.cacheControl, "public, max-age=31536000, immutable");
    assertEquals(meta?.contentType, "application/json");
    // Check that meta file exists
    assertEquals(
      {
        ...JSON.parse(
          decoder.decode(
            meta?.body,
          ),
        ),
        uploaded_at: undefined,
      },
      {
        directory_listing: [
          {
            path: "",
            size: 2735,
            type: "dir",
          },
          {
            path: "/.github",
            size: 716,
            type: "dir",
          },
          {
            path: "/.github/README.md",
            size: 304,
            type: "file",
          },
          {
            path: "/.github/workflows",
            size: 412,
            type: "dir",
          },
          {
            path: "/.github/workflows/ci.yml",
            size: 412,
            type: "file",
          },
          {
            path: "/.vscode",
            size: 26,
            type: "dir",
          },
          {
            path: "/.vscode/settings.json",
            size: 26,
            type: "file",
          },
          {
            path: "/LICENSE",
            size: 1066,
            type: "file",
          },
          {
            path: "/deps.ts",
            size: 63,
            type: "file",
          },
          {
            path: "/example.ts",
            size: 50,
            type: "file",
          },
          {
            path: "/fixtures",
            size: 23,
            type: "dir",
          },
          {
            path: "/fixtures/%",
            size: 23,
            type: "file",
          },
          {
            path: "/mod.ts",
            size: 139,
            type: "file",
          },
          {
            path: "/mod_test.ts",
            size: 227,
            type: "file",
          },
          {
            path: "/subproject",
            size: 425,
            type: "dir",
          },
          {
            path: "/subproject/README.md",
            size: 354,
            type: "file",
          },
          {
            path: "/subproject/mod.ts",
            size: 71,
            type: "file",
          },
        ],
        upload_options: {
          ref: "0.0.9",
          repository: "luca-rand/testing",
          type: "github",
        },
        uploaded_at: undefined,
      },
    );

    let deps = await s3.getObject("ltest/versions/0.0.9/meta/deps.json");
    assertEquals(deps?.cacheControl, "public, max-age=31536000, immutable");
    assertEquals(deps?.contentType, "application/json");
    // Check that meta file exists
    assertEquals(
      JSON.parse(
        decoder.decode(
          deps?.body,
        ),
      ),
      {
        graph: {
          nodes: {
            "http://s3:9000/deno-registry2/ltest/versions/0.0.9/raw/deps.ts": {
              "imports": [
                "https://deno.land/std@0.64.0/uuid/mod.ts",
              ],
            },
            "https://deno.land/std@0.64.0/uuid/mod.ts": {
              "imports": [
                "https://deno.land/std@0.64.0/uuid/v1.ts",
                "https://deno.land/std@0.64.0/uuid/v4.ts",
                "https://deno.land/std@0.64.0/uuid/v5.ts",
              ],
            },
            "https://deno.land/std@0.64.0/uuid/v1.ts": {
              "imports": [
                "https://deno.land/std@0.64.0/uuid/_common.ts",
              ],
            },
            "https://deno.land/std@0.64.0/uuid/_common.ts": {
              "imports": [],
            },
            "https://deno.land/std@0.64.0/uuid/v4.ts": {
              "imports": [
                "https://deno.land/std@0.64.0/uuid/_common.ts",
              ],
            },
            "https://deno.land/std@0.64.0/uuid/v5.ts": {
              "imports": [
                "https://deno.land/std@0.64.0/uuid/_common.ts",
                "https://deno.land/std@0.64.0/hash/sha1.ts",
                "https://deno.land/std@0.64.0/node/util.ts",
                "https://deno.land/std@0.64.0/_util/assert.ts",
              ],
            },
            "https://deno.land/std@0.64.0/hash/sha1.ts": {
              "imports": [],
            },
            "https://deno.land/std@0.64.0/node/util.ts": {
              "imports": [
                "https://deno.land/std@0.64.0/node/_util/_util_promisify.ts",
                "https://deno.land/std@0.64.0/node/_util/_util_callbackify.ts",
                "https://deno.land/std@0.64.0/node/_util/_util_types.ts",
                "https://deno.land/std@0.64.0/node/_utils.ts",
              ],
            },
            "https://deno.land/std@0.64.0/node/_util/_util_promisify.ts": {
              "imports": [],
            },
            "https://deno.land/std@0.64.0/node/_util/_util_callbackify.ts": {
              "imports": [],
            },
            "https://deno.land/std@0.64.0/node/_util/_util_types.ts": {
              "imports": [],
            },
            "https://deno.land/std@0.64.0/node/_utils.ts": {
              "imports": [],
            },
            "https://deno.land/std@0.64.0/_util/assert.ts": {
              "imports": [],
            },
            "http://s3:9000/deno-registry2/ltest/versions/0.0.9/raw/example.ts":
              {
                "imports": [
                  "http://s3:9000/deno-registry2/ltest/versions/0.0.9/raw/mod.ts",
                ],
              },
            "http://s3:9000/deno-registry2/ltest/versions/0.0.9/raw/mod.ts": {
              "imports": [
                "http://s3:9000/deno-registry2/ltest/versions/0.0.9/raw/deps.ts",
              ],
            },
            "http://s3:9000/deno-registry2/ltest/versions/0.0.9/raw/mod_test.ts":
              {
                "imports": [
                  "https://deno.land/std@0.64.0/testing/asserts.ts",
                ],
              },
            "https://deno.land/std@0.64.0/testing/asserts.ts": {
              "imports": [
                "https://deno.land/std@0.64.0/fmt/colors.ts",
                "https://deno.land/std@0.64.0/testing/diff.ts",
              ],
            },
            "https://deno.land/std@0.64.0/fmt/colors.ts": {
              "imports": [],
            },
            "https://deno.land/std@0.64.0/testing/diff.ts": {
              "imports": [],
            },
            "http://s3:9000/deno-registry2/ltest/versions/0.0.9/raw/subproject/mod.ts":
              {
                "imports": [],
              },
          },
        },
      },
    );

    // Check the yml file was uploaded
    let yml = await s3.getObject(
      "ltest/versions/0.0.9/raw/.github/workflows/ci.yml",
    );
    assertEquals(yml?.cacheControl, "public, max-age=31536000, immutable");
    assertEquals(yml?.contentType, "text/yaml");
    assertEquals(yml?.body.length, 412);

    // Check the ts file was uploaded
    let ts = await s3.getObject("ltest/versions/0.0.9/raw/mod.ts");
    assertEquals(ts?.cacheControl, "public, max-age=31536000, immutable");
    assertEquals(ts?.contentType, "application/typescript; charset=utf-8");
    assertEquals(ts?.body.length, 139);

    // Check the ts file was uploaded
    let readme = await s3.getObject(
      "ltest/versions/0.0.9/raw/.github/README.md",
    );
    assertEquals(readme?.cacheControl, "public, max-age=31536000, immutable");
    assertEquals(readme?.contentType, "text/markdown");
    assertEquals(readme?.body.length, 304);

    // Cleanup
    await database._builds.deleteMany({});
    await s3.deleteObject("ltest/meta/versions.json");
    await s3.deleteObject("ltest/versions/0.0.9/meta/meta.json");
    await s3.deleteObject("ltest/versions/0.0.9/meta/deps.json");
    await s3.deleteObject("ltest/versions/0.0.9/raw/.github/workflows/ci.yml");
    await s3.deleteObject("ltest/versions/0.0.9/raw/.vscode/settings.json");
    await s3.deleteObject("ltest/versions/0.0.9/raw/LICENCE");
    await s3.deleteObject("ltest/versions/0.0.9/raw/deps.ts");
    await s3.deleteObject("ltest/versions/0.0.9/raw/fixtures/%");
    await s3.deleteObject("ltest/versions/0.0.9/raw/mod.ts");
    await s3.deleteObject("ltest/versions/0.0.9/raw/mod_test.md");
    await s3.deleteObject("ltest/versions/0.0.9/raw/subproject/README.md");
    await s3.deleteObject("ltest/versions/0.0.9/raw/subproject/mod.ts");
  },
});

Deno.test({
  name: "publish success subdir",
  async fn() {
    const id = await database.createBuild({
      options: {
        moduleName: "ltest",
        ref: "0.0.7",
        repository: "luca-rand/testing",
        type: "github",
        version: "0.0.7",
        subdir: "subproject/",
      },
      status: "queued",
    });

    await handler(
      createSQSEvent({ buildID: id }),
      createContext(),
    );

    assertEquals({ ...await database.getBuild(id), created_at: undefined }, {
      created_at: undefined,
      id,
      options: {
        moduleName: "ltest",
        ref: "0.0.7",
        repository: "luca-rand/testing",
        type: "github",
        version: "0.0.7",
        subdir: "subproject/",
      },
      status: "success",
      message: "Published module.",
      stats: {
        skipped_due_to_size: [],
        total_files: 2,
        total_size: 425,
      },
    });

    // Check that versions.json file exists
    let versions = await s3.getObject("ltest/meta/versions.json");
    assertEquals(versions?.cacheControl, "max-age=10, must-revalidate");
    assertEquals(versions?.contentType, "application/json");
    assertEquals(
      JSON.parse(decoder.decode(versions?.body)),
      { latest: "0.0.7", versions: ["0.0.7"] },
    );

    let meta = await s3.getObject("ltest/versions/0.0.7/meta/meta.json");
    assertEquals(meta?.cacheControl, "public, max-age=31536000, immutable");
    assertEquals(meta?.contentType, "application/json");
    // Check that meta file exists
    assertEquals(
      {
        ...JSON.parse(
          decoder.decode(
            meta?.body,
          ),
        ),
        uploaded_at: undefined,
      },
      {
        directory_listing: [
          {
            path: "",
            size: 425,
            type: "dir",
          },
          {
            path: "/README.md",
            size: 354,
            type: "file",
          },
          {
            path: "/mod.ts",
            size: 71,
            type: "file",
          },
        ],
        upload_options: {
          ref: "0.0.7",
          repository: "luca-rand/testing",
          subdir: "subproject/",
          type: "github",
        },
        uploaded_at: undefined,
      },
    );

    // Check the ts file was uploaded
    let ts = await s3.getObject("ltest/versions/0.0.7/raw/mod.ts");
    assertEquals(ts?.cacheControl, "public, max-age=31536000, immutable");
    assertEquals(ts?.contentType, "application/typescript; charset=utf-8");
    assertEquals(ts?.body.length, 71);

    // Check the ts file was uploaded
    let readme = await s3.getObject("ltest/versions/0.0.7/raw/README.md");
    assertEquals(readme?.cacheControl, "public, max-age=31536000, immutable");
    assertEquals(readme?.contentType, "text/markdown");
    assertEquals(readme?.body.length, 354);

    // Cleanup
    await database._builds.deleteMany({});
    await s3.deleteObject("ltest/meta/versions.json");
    await s3.deleteObject("ltest/versions/0.0.7/meta/meta.json");
    await s3.deleteObject("ltest/versions/0.0.7/raw/mod.ts");
    await s3.deleteObject("ltest/versions/0.0.7/raw/README.md");
  },
});
