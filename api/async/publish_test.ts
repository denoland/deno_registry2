import { handler } from "./publish.ts";
import {
  cleanupDatabase,
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
    try {
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
          total_files: 11,
          total_size: 2735,
        },
      });

      // Check that versions.json file exists
      const versions = await s3.getObject("ltest/meta/versions.json");
      assertEquals(versions?.cacheControl, "max-age=10, must-revalidate");
      assertEquals(versions?.contentType, "application/json");
      assertEquals(
        JSON.parse(decoder.decode(versions?.body)),
        { latest: "0.0.9", versions: ["0.0.9"] },
      );

      const meta = await s3.getObject("ltest/versions/0.0.9/meta/meta.json");
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

      const deps = await s3.getObject("ltest/versions/0.0.9/meta/deps_v2.json");
      assertEquals(deps?.cacheControl, "max-age=10, must-revalidate");
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
              "http://s3:9000/deno-registry2/ltest/versions/0.0.9/raw/deps.ts":
                {
                  deps: ["https://deno.land/std@0.64.0/uuid/mod.ts"],
                  size: 63,
                },
              "https://deno.land/std@0.64.0/uuid/mod.ts": {
                deps: [
                  "https://deno.land/std@0.64.0/uuid/v1.ts",
                  "https://deno.land/std@0.64.0/uuid/v4.ts",
                  "https://deno.land/std@0.64.0/uuid/v5.ts",
                ],
                size: 601,
              },
              "https://deno.land/std@0.64.0/uuid/v1.ts": {
                deps: ["https://deno.land/std@0.64.0/uuid/_common.ts"],
                size: 2545,
              },
              "https://deno.land/std@0.64.0/uuid/_common.ts": {
                deps: [],
                size: 1207,
              },
              "https://deno.land/std@0.64.0/uuid/v4.ts": {
                deps: ["https://deno.land/std@0.64.0/uuid/_common.ts"],
                size: 542,
              },
              "https://deno.land/std@0.64.0/uuid/v5.ts": {
                deps: [
                  "https://deno.land/std@0.64.0/_util/assert.ts",
                  "https://deno.land/std@0.64.0/hash/sha1.ts",
                  "https://deno.land/std@0.64.0/node/util.ts",
                  "https://deno.land/std@0.64.0/uuid/_common.ts",
                ],
                size: 1340,
              },
              "https://deno.land/std@0.64.0/hash/sha1.ts": {
                deps: [],
                size: 11033,
              },
              "https://deno.land/std@0.64.0/node/util.ts": {
                deps: [
                  "https://deno.land/std@0.64.0/node/_util/_util_callbackify.ts",
                  "https://deno.land/std@0.64.0/node/_util/_util_promisify.ts",
                  "https://deno.land/std@0.64.0/node/_util/_util_types.ts",
                  "https://deno.land/std@0.64.0/node/_utils.ts",
                ],
                size: 2298,
              },
              "https://deno.land/std@0.64.0/node/_util/_util_promisify.ts": {
                deps: [],
                size: 4839,
              },
              "https://deno.land/std@0.64.0/node/_util/_util_callbackify.ts": {
                deps: [],
                size: 4287,
              },
              "https://deno.land/std@0.64.0/node/_util/_util_types.ts": {
                deps: [],
                size: 7362,
              },
              "https://deno.land/std@0.64.0/node/_utils.ts": {
                deps: [],
                size: 3807,
              },
              "https://deno.land/std@0.64.0/_util/assert.ts": {
                deps: [],
                size: 405,
              },
              "http://s3:9000/deno-registry2/ltest/versions/0.0.9/raw/example.ts":
                {
                  deps: [
                    "http://s3:9000/deno-registry2/ltest/versions/0.0.9/raw/mod.ts",
                  ],
                  size: 50,
                },
              "http://s3:9000/deno-registry2/ltest/versions/0.0.9/raw/mod.ts": {
                deps: [
                  "http://s3:9000/deno-registry2/ltest/versions/0.0.9/raw/deps.ts",
                ],
                size: 139,
              },
              "http://s3:9000/deno-registry2/ltest/versions/0.0.9/raw/mod_test.ts":
                {
                  deps: ["https://deno.land/std@0.64.0/testing/asserts.ts"],
                  size: 227,
                },
              "https://deno.land/std@0.64.0/testing/asserts.ts": {
                deps: [
                  "https://deno.land/std@0.64.0/fmt/colors.ts",
                  "https://deno.land/std@0.64.0/testing/diff.ts",
                ],
                size: 12246,
              },
              "https://deno.land/std@0.64.0/fmt/colors.ts": {
                deps: [],
                size: 5774,
              },
              "https://deno.land/std@0.64.0/testing/diff.ts": {
                deps: [],
                size: 5473,
              },
              "http://s3:9000/deno-registry2/ltest/versions/0.0.9/raw/subproject/mod.ts":
                { deps: [], size: 71 },
            },
          },
        },
      );

      // Check the yml file was uploaded
      const yml = await s3.getObject(
        "ltest/versions/0.0.9/raw/.github/workflows/ci.yml",
      );
      assertEquals(yml?.cacheControl, "public, max-age=31536000, immutable");
      assertEquals(yml?.contentType, "text/yaml");
      assertEquals(yml?.body.length, 412);

      // Check the ts file was uploaded
      const ts = await s3.getObject("ltest/versions/0.0.9/raw/mod.ts");
      assertEquals(ts?.cacheControl, "public, max-age=31536000, immutable");
      assertEquals(ts?.contentType, "application/typescript; charset=utf-8");
      assertEquals(ts?.body.length, 139);

      // Check the ts file was uploaded
      const readme = await s3.getObject(
        "ltest/versions/0.0.9/raw/.github/README.md",
      );
      assertEquals(readme?.cacheControl, "public, max-age=31536000, immutable");
      assertEquals(readme?.contentType, "text/markdown");
      assertEquals(readme?.body.length, 304);
    } finally {
      await cleanupDatabase(database);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "publish success subdir",
  async fn() {
    try {
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
          total_files: 2,
          total_size: 425,
        },
      });

      // Check that versions.json file exists
      const versions = await s3.getObject("ltest/meta/versions.json");
      assertEquals(versions?.cacheControl, "max-age=10, must-revalidate");
      assertEquals(versions?.contentType, "application/json");
      assertEquals(
        JSON.parse(decoder.decode(versions?.body)),
        { latest: "0.0.7", versions: ["0.0.7"] },
      );

      const meta = await s3.getObject("ltest/versions/0.0.7/meta/meta.json");
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
      const ts = await s3.getObject("ltest/versions/0.0.7/raw/mod.ts");
      assertEquals(ts?.cacheControl, "public, max-age=31536000, immutable");
      assertEquals(ts?.contentType, "application/typescript; charset=utf-8");
      assertEquals(ts?.body.length, 71);

      // Check the ts file was uploaded
      const readme = await s3.getObject("ltest/versions/0.0.7/raw/README.md");
      assertEquals(readme?.cacheControl, "public, max-age=31536000, immutable");
      assertEquals(readme?.contentType, "text/markdown");
      assertEquals(readme?.body.length, 354);
    } finally {
      await cleanupDatabase(database);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "publish too large",
  async fn() {
    try {
      const id = await database.createBuild({
        options: {
          moduleName: "ltest_big",
          ref: "0.0.1",
          repository: "luca-rand/testing_big",
          type: "github",
          version: "0.0.1",
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
          moduleName: "ltest_big",
          ref: "0.0.1",
          repository: "luca-rand/testing_big",
          type: "github",
          version: "0.0.1",
        },
        status: "error",
        message:
          "Module too large (26214825 bytes). Maximum allowed size is 20971520 bytes.",
        stats: undefined,
      });

      // Check that versions.json file does not exists
      const versions = await s3.getObject("ltest/meta/versions.json");
      assertEquals(versions, undefined);

      const meta = await s3.getObject("ltest/versions/0.0.1/meta/meta.json");
      assertEquals(meta, undefined);

      // Check the readme file was not uploaded
      const readme = await s3.getObject("ltest/versions/0.0.1/raw/README.md");
      assertEquals(readme, undefined);
    } finally {
      await cleanupDatabase(database);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "publish large custom quota",
  async fn() {
    try {
      await database.saveOwnerQuota({
        owner: "luca-rand",
        type: "github",
        max_modules: 7,
        max_total_size: 1024 * 1024 * 50,
        blocked: false,
      });

      const id = await database.createBuild({
        options: {
          moduleName: "ltest_big",
          ref: "0.0.1",
          repository: "luca-rand/testing_big",
          type: "github",
          version: "0.0.1",
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
          moduleName: "ltest_big",
          ref: "0.0.1",
          repository: "luca-rand/testing_big",
          type: "github",
          version: "0.0.1",
        },
        status: "success",
        message: "Published module.",
        stats: {
          total_files: 28,
          total_size: 26214825,
        },
      });

      // Check that versions.json file exists
      const versions = await s3.getObject("ltest_big/meta/versions.json");
      assertEquals(versions?.cacheControl, "max-age=10, must-revalidate");
      assertEquals(versions?.contentType, "application/json");
      assertEquals(
        JSON.parse(decoder.decode(versions?.body)),
        { latest: "0.0.1", versions: ["0.0.1"] },
      );
    } finally {
      await cleanupDatabase(database);
      await s3.empty();
    }
  },
});
