// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import { assert, assertEquals } from "../test_deps.ts";
import { Database, Module, Build, OwnerQuota } from "./database.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

await database._modules.deleteMany({});
await database._builds.deleteMany({});
await database._owner_quotas.deleteMany({});

const ltest: Module = {
  name: "ltest",
  description: "Testing all the things!",
  type: "github",
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
      name: ltest.name,
      description: ltest.description,
      star_count: ltest.star_count,
      search_score: undefined,
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

const ownerQuota1: OwnerQuota = {
  owner: "luca-rand",
  type: "github",
  max_modules: 5,
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
