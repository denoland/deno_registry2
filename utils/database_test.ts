// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import { assert, assertEquals } from "../test_deps.ts";
import { Build, Database, Module, OwnerQuota } from "./database.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

await database._modules.deleteMany({});
await database._builds.deleteMany({});
await database._owner_quotas.deleteMany({});

const ltest: Module = {
  name: "ltest",
  description: "Testing all the things!",
  type: "github",
  repo_id: 123,
  owner: "luca-rand",
  repo: "testing",
  star_count: 5,
  is_unlisted: false,
  created_at: new Date(2020, 1, 1),
};

const utest: Module = {
  name: "unlisted_module",
  description: "Testing all the things! -- unlisted",
  type: "github",
  repo_id: 124,
  owner: "wperron",
  repo: "testing-unlisted",
  star_count: 5,
  is_unlisted: true,
  created_at: new Date(2020, 1, 1),
};

Deno.test({
  name: "add, remove, list and count modules in database",
  async fn() {
    assertEquals(await database.listModules(10, 1), []);
    assertEquals(await database.countModules(), 0);

    await database.saveModule(ltest);
    await database.saveModule(utest);

    assertEquals(await database.listModules(10, 1), [{
      _id: "ltest",
      created_at: new Date("2020-02-01T00:00:00.000Z"),
      description: "Testing all the things!",
      is_unlisted: false,
      repo_id: 123,
      owner: "luca-rand",
      repo: "testing",
      star_count: 5,
      type: "github",
    }]);
    assertEquals(await database.countModules(), 1);
    assertEquals(await database.getModule(ltest.name), ltest);

    const ltestWith6Stars = { ...ltest, star_count: 6 };

    await database.saveModule(ltestWith6Stars);
    assertEquals(await database.countModules(), 1);
    assertEquals(
      await database.getModule(ltest.name),
      ltestWith6Stars,
    );

    // Cleanup
    await database._modules.deleteMany({});
  },
});

const build1: Omit<Omit<Build, "id">, "created_at"> = {
  options: {
    moduleName: "ltest",
    type: "github",
    repository: "luca-rand/testing",
    ref: "v0.4.0",
    version: "0.4.0",
    subdir: "subdir1",
  },
  status: "success",
  message: "bla bla bla",
};

const build2: Omit<Omit<Build, "id">, "created_at"> = {
  options: {
    moduleName: "wtest",
    type: "github",
    repository: "wperron-rand/testing",
    ref: "v0.4.0",
    version: "0.4.0",
    subdir: "subdir1",
  },
  status: "success",
  message: "bla bla bla",
};

Deno.test({
  name: "add, update, and get builds in database",
  async fn() {
    const id = await database.createBuild(build1);
    const build = await database.getBuild(id);
    assert(build);
    assert(build.created_at);
    // deno-lint-ignore ban-ts-comment
    // @ts-expect-error
    build.created_at = undefined;
    assertEquals(
      build,
      { ...build1, id, created_at: undefined, stats: undefined },
    );

    // Cleanup
    await database._builds.deleteMany({});
  },
});

Deno.test({
  name: "count builds",
  async fn() {
    // check there are no versions in a clean database
    let count = await database.countAllVersions();
    assertEquals(count, 0);

    // check count after adding 1 build
    const id = await database.createBuild(build1);
    const build = await database.getBuild(id) as Build;
    count = await database.countAllVersions();
    assertEquals(count, 1);

    // check count after adding 5 new versions
    for (let i = 5; i < 10; i++) {
      build.options.ref = `v.0.${i}.0`;
      build.options.version = `0.${i}.0`;
      await database.createBuild(build);
    }

    count = await database.countAllVersions();
    assertEquals(count, 6);

    // check count after adding second module
    await database.createBuild(build2);
    count = await database.countAllVersions();
    assertEquals(count, 7);

    // Cleanup
    await database._builds.deleteMany({});
  },
});

const ownerQuota1: OwnerQuota = {
  owner: "luca-rand",
  type: "github",
  max_modules: 5,
  blocked: false,
};

Deno.test({
  name: "add and get owner quotas in database",
  async fn() {
    await database.saveOwnerQuota(ownerQuota1);
    const ownerQuota = await database.getOwnerQuota(
      ownerQuota1.owner,
    );
    assertEquals(
      ownerQuota,
      ownerQuota1,
    );

    // Cleanup
    await database._owner_quotas.deleteMany({});
  },
});
