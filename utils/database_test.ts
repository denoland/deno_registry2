// Copyright 2020 the Deno authors. All rights reserved. MIT license.

import { assert, assertEquals } from "../test_deps.ts";
import { Database, Module, Build } from "./database.ts";

const database = new Database("mongodb://localhost:27017");

await database._modules.deleteMany({});
await database._builds.deleteMany({});

const ltest: Module = {
  name: "ltest",
  description: "Testing all the things!",
  type: "github",
  repository: "luca-rand/testing",
  star_count: 5,
};

Deno.test({
  name: "add, remove, list and count modules in database",
  async fn() {
    assertEquals(await database.listModules(10, 1), []);
    assertEquals(await database.countModules(), 0);

    await database.saveModule(ltest);

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
    assertEquals(build, { ...build1, id });
  },
});
