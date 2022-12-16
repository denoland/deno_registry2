// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

import { assert, assertEquals } from "../test_deps.ts";
import { Build, Database, Module } from "./database.ts";
import {
  Database as Datastore,
  kinds,
  OwnerQuota,
} from "./datastore_database.ts";
import { cleanupDatabase } from "./test_utils.ts";

const database = await Database.connect(Deno.env.get("MONGO_URI")!);

await database._modules.deleteMany({});
await database._builds.deleteMany({});

const datastore = new Datastore();

const ltest: Module = {
  name: "ltest",
  description: "Testing all the things!",
  type: "github",
  // deno-lint-ignore camelcase
  repo_id: 123,
  owner: "luca-rand",
  repo: "testing",
  // deno-lint-ignore camelcase
  star_count: 5,
  // deno-lint-ignore camelcase
  is_unlisted: false,
  // deno-lint-ignore camelcase
  created_at: new Date(2020, 1, 1),
};

const utest: Module = {
  name: "unlisted_module",
  description: "Testing all the things! -- unlisted",
  type: "github",
  // deno-lint-ignore camelcase
  repo_id: 124,
  owner: "wperron",
  repo: "testing-unlisted",
  // deno-lint-ignore camelcase
  star_count: 5,
  // deno-lint-ignore camelcase
  is_unlisted: true,
  // deno-lint-ignore camelcase
  created_at: new Date(2020, 1, 1),
};

Deno.test({
  name: "add, remove, list and count modules in database",
  async fn() {
    assertEquals(
      await database.listModules({ limit: 10, page: 1 }),
      [{ limit: 10, page: 1, sort: "stars" }, []],
    );
    assertEquals(await database.countModules(), 0);

    await database.saveModule(ltest);
    await database.saveModule(utest);

    assertEquals(await database.listModules({ limit: 10, page: 1 }), [
      {
        limit: 10,
        page: 1,
        sort: "stars",
      },
      [
        // @ts-expect-error ignore search_score, because the exact value is not important
        {
          _id: "ltest",
          created_at: new Date("2020-02-01T00:00:00.000Z"),
          description: "Testing all the things!",
          is_unlisted: false,
          repo_id: 123,
          owner: "luca-rand",
          repo: "testing",
          star_count: 5,
          type: "github",
        },
      ],
    ]);
    assertEquals(await database.countModules(), 1);
    assertEquals(await database.getModule(ltest.name), ltest);

    // deno-lint-ignore camelcase
    const ltestWith6Stars = { ...ltest, star_count: 6 };

    await database.saveModule(ltestWith6Stars);
    assertEquals(await database.countModules(), 1);
    assertEquals(
      await database.getModule(ltest.name),
      ltestWith6Stars,
    );

    // Cleanup
    await database.deleteModule(ltest.name);
    await database.deleteModule(utest.name);
  },
});

const build1: Omit<Build, "id"> = {
  options: {
    moduleName: "ltest",
    type: "github",
    repository: "luca-rand/testing",
    ref: "v0.4.0",
    version: "0.4.0",
    subdir: "subdir1/",
  },
  status: "success",
  message: "bla bla bla",
  created_at: new Date(),
};

const build2: Omit<Build, "id"> = {
  options: {
    moduleName: "wtest",
    type: "github",
    repository: "wperron-rand/testing",
    ref: "v0.4.0",
    version: "0.4.0",
    subdir: "subdir1/",
  },
  status: "success",
  message: "bla bla bla",
  created_at: new Date(),
};

Deno.test({
  name: "add, update, and get builds in database",
  async fn() {
    try {
      const id = await datastore.createBuild(build1);
      const build = await datastore.getBuild(id);
      assert(build);
      assert(build.created_at);
      assertEquals(
        build,
        {
          ...build1,
          id,
          created_at: build.created_at,
        },
      );
    } finally {
      await cleanupDatabase(database, datastore);
    }
  },
});

Deno.test({
  name: "count builds",
  async fn() {
    try {
      // check there are no versions in a clean database
      let count = await datastore.countAllBuilds();
      assertEquals(count, 0);

      // check count after adding 1 build
      const id = await datastore.createBuild(build1);
      const build = await datastore.getBuild(id) as Build;
      count = await datastore.countAllBuilds();
      assertEquals(count, 1);

      // check count after adding 5 new versions
      for (let i = 5; i < 10; i++) {
        build.options.ref = `v.0.${i}.0`;
        build.options.version = `0.${i}.0`;
        await datastore.createBuild(build);
      }

      count = await datastore.countAllBuilds();
      assertEquals(count, 6);

      // check count after adding second module
      await datastore.createBuild(build2);
      count = await datastore.countAllBuilds();
      assertEquals(count, 7);
    } finally {
      await cleanupDatabase(database, datastore);
    }
  },
});

const ownerQuota1: OwnerQuota = {
  owner: "luca-rand",
  type: "github",
  // deno-lint-ignore camelcase
  max_modules: 5,
  // deno-lint-ignore camelcase
  max_total_size: undefined,
  blocked: false,
};

Deno.test({
  name: "add and get owner quotas in database",
  async fn() {
    await datastore.saveOwnerQuota(ownerQuota1);
    const ownerQuota = await datastore.getOwnerQuota(
      ownerQuota1.owner,
    );
    assertEquals(
      ownerQuota,
      {
        owner: "luca-rand",
        type: "github",
        max_modules: 5,
        blocked: false,
      },
    );

    const key = datastore.db.key([kinds.LEGACY_OWNER_QUOTAS, "luca-rand"]);

    for await (
      const _ of datastore.db.commit([{ delete: key }], {
        transactional: false,
      })
    ) {
      // empty
    }
  },
});
