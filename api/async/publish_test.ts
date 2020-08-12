import { handler } from "./publish.ts";
import {
  createContext,
  createSQSEvent,
} from "../../utils/test_utils.ts";
import { join } from "../../deps.ts";
import { assertEquals } from "../../test_deps.ts";
import { Database } from "../../utils/database.ts";
import { s3, getMeta } from "../../utils/storage.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

const decoder = new TextDecoder();

Deno.test({
  name: "publish success",
  async fn() {
    const id = await database.createBuild({
      options: {
        moduleName: "ltest",
        ref: "0.0.7",
        repository: "luca-rand/testing",
        type: "github",
        version: "0.0.7",
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
      },
      status: "success",
      message: "Finished processing module",
      stats: {
        skipped_due_to_size: [],
        total_files: 7,
        total_size: 2317,
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
            size: 2317,
            type: "dir",
          },
          {
            path: "/.github",
            size: 412,
            type: "dir",
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
            path: "/LICENSE",
            size: 1066,
            type: "file",
          },
          {
            path: "/README.md",
            size: 304,
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
            size: 87,
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
          ref: "0.0.7",
          repository: "luca-rand/testing",
          type: "github",
        },
        uploaded_at: undefined,
      },
    );

    // Check the yml file was uploaded
    let yml = await s3.getObject(
      "ltest/versions/0.0.7/raw/.github/workflows/ci.yml",
    );
    assertEquals(yml?.cacheControl, "public, max-age=31536000, immutable");
    assertEquals(yml?.contentType, "text/yaml");
    assertEquals(yml?.body.length, 412);

    // Check the ts file was uploaded
    let ts = await s3.getObject("ltest/versions/0.0.7/raw/mod.ts");
    assertEquals(ts?.cacheControl, "public, max-age=31536000, immutable");
    assertEquals(ts?.contentType, "application/typescript; charset=utf-8");
    assertEquals(ts?.body.length, 87);

    // Check the ts file was uploaded
    let readme = await s3.getObject("ltest/versions/0.0.7/raw/README.md");
    assertEquals(readme?.cacheControl, "public, max-age=31536000, immutable");
    assertEquals(readme?.contentType, "text/markdown");
    assertEquals(readme?.body.length, 304);

    // Cleanup
    await database._builds.deleteMany({});
    await s3.deleteObject("ltest/meta/versions.json");
    await s3.deleteObject("ltest/versions/0.0.7/meta/meta.json");
    await s3.deleteObject("ltest/versions/0.0.7/raw/.github/workflows/ci.yml");
    await s3.deleteObject("ltest/versions/0.0.7/raw/LICENCE");
    await s3.deleteObject("ltest/versions/0.0.7/raw/README.md");
    await s3.deleteObject("ltest/versions/0.0.7/raw/fixtures/%");
    await s3.deleteObject("ltest/versions/0.0.7/raw/mod.ts");
    await s3.deleteObject("ltest/versions/0.0.7/raw/subproject/README.md");
    await s3.deleteObject("ltest/versions/0.0.7/raw/subproject/mod.ts");
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
      message: "Finished processing module",
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

Deno.test({
  name: "publish success 0.0.9",
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
      message: "Finished processing module",
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
