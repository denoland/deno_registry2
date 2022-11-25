// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.
import { handler } from "./publish.ts";
import {
  cleanupDatabase,
  createApiLandMock,
  createContext,
  createSQSEvent,
} from "../../utils/test_utils.ts";
import { assert, assertEquals } from "../../test_deps.ts";
import { Database } from "../../utils/database.ts";
import { s3 } from "../../utils/storage.ts";

const database = await Database.connect(Deno.env.get("MONGO_URI")!);

Deno.test({
  name: "publish success",
  async fn() {
    try {
      createApiLandMock();
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
      });

      // Check that versions.json file exists
      const versions = await s3.getObject("ltest/meta/versions.json");
      assertEquals(versions?.cacheControl, "max-age=10, must-revalidate");
      assertEquals(versions?.contentType, "application/json");
      assert(versions);
      assertEquals(
        await new Response(versions.body).json(),
        { latest: "0.0.9", versions: ["0.0.9"] },
      );

      const meta = await s3.getObject("ltest/versions/0.0.9/meta/meta.json");
      assertEquals(meta?.cacheControl, "public, max-age=31536000, immutable");
      assertEquals(meta?.contentType, "application/json");
      // Check that meta file exists
      assert(meta);
      assertEquals(
        {
          ...await new Response(meta.body).json(),
          uploaded_at: undefined,
        },
        {
          upload_options: {
            ref: "0.0.9",
            repository: "luca-rand/testing",
            type: "github",
          },
          uploaded_at: undefined,
        },
      );

      // Check the yml file was uploaded
      const yml = await s3.getObject(
        "ltest/versions/0.0.9/raw/.github/workflows/ci.yml",
      );
      assertEquals(yml?.cacheControl, "public, max-age=31536000, immutable");
      assertEquals(yml?.contentType, "text/yaml");
      assert(yml);
      let body = await new Response(yml.body).arrayBuffer();
      assertEquals(body.byteLength, 412);

      // Check the ts file was uploaded
      const ts = await s3.getObject("ltest/versions/0.0.9/raw/mod.ts");
      assertEquals(ts?.cacheControl, "public, max-age=31536000, immutable");
      assertEquals(ts?.contentType, "application/typescript; charset=utf-8");
      assert(ts);
      body = await new Response(ts.body).arrayBuffer();
      assertEquals(body.byteLength, 139);

      // Check the ts file was uploaded
      const readme = await s3.getObject(
        "ltest/versions/0.0.9/raw/.github/README.md",
      );
      assertEquals(readme?.cacheControl, "public, max-age=31536000, immutable");
      assertEquals(readme?.contentType, "text/markdown");
      assert(readme);
      body = await new Response(readme.body).arrayBuffer();
      console.log(new TextDecoder().decode(body));
      assertEquals(body.byteLength, 304);
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
      createApiLandMock();
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
      });

      // Check that versions.json file exists
      const versions = await s3.getObject("ltest/meta/versions.json");
      assertEquals(versions?.cacheControl, "max-age=10, must-revalidate");
      assertEquals(versions?.contentType, "application/json");
      assert(versions);
      assertEquals(
        await new Response(versions.body).json(),
        { latest: "0.0.7", versions: ["0.0.7"] },
      );

      const meta = await s3.getObject("ltest/versions/0.0.7/meta/meta.json");
      assertEquals(meta?.cacheControl, "public, max-age=31536000, immutable");
      assertEquals(meta?.contentType, "application/json");
      // Check that meta file exists
      assert(meta);
      assertEquals(
        {
          ...await new Response(meta.body).json(),
          uploaded_at: undefined,
        },
        {
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
      assert(ts);
      let body = await new Response(ts.body).arrayBuffer();
      assertEquals(body.byteLength, 71);

      // Check the ts file was uploaded
      const readme = await s3.getObject("ltest/versions/0.0.7/raw/README.md");
      assertEquals(readme?.cacheControl, "public, max-age=31536000, immutable");
      assertEquals(readme?.contentType, "text/markdown");
      assert(readme);
      body = await new Response(readme.body).arrayBuffer();
      assertEquals(body.byteLength, 354);
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
      createApiLandMock();
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
      });

      // Check that versions.json file exists
      const versions = await s3.getObject("ltest_big/meta/versions.json");
      assertEquals(versions?.cacheControl, "max-age=10, must-revalidate");
      assertEquals(versions?.contentType, "application/json");
      assert(versions);
      assertEquals(
        await new Response(versions.body).json(),
        { latest: "0.0.1", versions: ["0.0.1"] },
      );
    } finally {
      await cleanupDatabase(database);
      await s3.empty();
    }
  },
});
