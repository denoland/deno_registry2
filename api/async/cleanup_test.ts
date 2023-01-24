import { assert, assertEquals } from "../../test_deps.ts";
import {
  cleanupDatabase,
  createContext,
  createScheduledEvent,
} from "../../utils/test_utils.ts";
import { handler } from "./cleanup.ts";
import { s3 } from "../../utils/storage.ts";
import {
  Database as Datastore,
  Module,
} from "../../utils/datastore_database.ts";

const datastore = new Datastore();

const ltest: Module = {
  name: "recent",
  description: "Testing all the things! -- recent",
  // deno-lint-ignore camelcase
  repo_id: 274939732,
  type: "github",
  owner: "luca-rand",
  repo: "testing",
  // deno-lint-ignore camelcase
  star_count: 0, // real number is 2 atm
  // deno-lint-ignore camelcase
  is_unlisted: false,
  // deno-lint-ignore camelcase
  created_at: new Date(),
};

const utest: Module = {
  name: "old",
  description: "Testing all the things! -- old",
  // deno-lint-ignore camelcase
  repo_id: 70289105,
  type: "github",
  owner: "wperron",
  repo: "testing",
  // deno-lint-ignore camelcase
  star_count: 0,
  // deno-lint-ignore camelcase
  is_unlisted: false,
  // deno-lint-ignore camelcase
  created_at: new Date(2018, 1, 1),
};

const unlistedTest: Module = {
  name: "old_unlisted",
  description: "Testing all the things! -- old and unlisted",
  // deno-lint-ignore camelcase
  repo_id: 70289105,
  type: "github",
  owner: "wperron",
  repo: "testing",
  // deno-lint-ignore camelcase
  star_count: 0,
  // deno-lint-ignore camelcase
  is_unlisted: true,
  // deno-lint-ignore camelcase
  created_at: new Date(2018, 1, 1),
};

Deno.test({
  name: "inactive modules cleanup default",
  async fn() {
    try {
      await datastore.saveModule(ltest);
      await datastore.saveModule(utest);

      await handler(
        createScheduledEvent(),
        createContext(),
      );

      const list = await datastore.listAllModuleNames();
      assert(list.length === 2);
    } finally {
      await cleanupDatabase(datastore);
      await s3.empty();
      Deno.env.delete("DRYRUN");
    }
  },
});

Deno.test({
  name: "inactive modules cleanup deactivated",
  async fn() {
    try {
      await datastore.saveModule(ltest);
      await datastore.saveModule(utest);

      Deno.env.set("DRYRUN", "1");

      await handler(
        createScheduledEvent(),
        createContext(),
      );

      const list = await datastore.listAllModuleNames();
      assert(list.length === 2);
    } finally {
      await cleanupDatabase(datastore);
      await s3.empty();
      Deno.env.delete("DRYRUN");
    }
  },
});

Deno.test({
  name: "inactive modules cleanup activated",
  async fn() {
    try {
      await datastore.saveModule(ltest);
      await datastore.saveModule(utest);

      Deno.env.set("DRYRUN", "");

      await handler(
        createScheduledEvent(),
        createContext(),
      );

      const list = await datastore.listAllModuleNames();
      assert(list.length === 1);
      assertEquals(list[0], "recent");
    } finally {
      await cleanupDatabase(datastore);
      await s3.empty();
      Deno.env.delete("DRYRUN");
    }
  },
});

Deno.test({
  name: "inactive modules cleanup unlisted",
  async fn() {
    try {
      await datastore.saveModule(unlistedTest);

      Deno.env.set("DRYRUN", "");

      await handler(
        createScheduledEvent(),
        createContext(),
      );

      const list = await datastore.listAllModules();
      assert(list.length === 1);
      assertEquals(list[0].name, "old_unlisted");
    } finally {
      await cleanupDatabase(datastore);
      await s3.empty();
      Deno.env.delete("DRYRUN");
    }
  },
});

Deno.test({
  name: "inactive modules cleanup old but published",
  async fn() {
    try {
      await datastore.saveModule(utest);
      await datastore.createBuild({
        options: {
          moduleName: "old",
          type: "github",
          repository: "wperron/testing",
          ref: "0.4.0",
          version: "0.4.0",
        },
        status: "success",
        message: "bla bla bla",
        created_at: new Date(),
      });

      Deno.env.set("DRYRUN", "");

      await handler(
        createScheduledEvent(),
        createContext(),
      );

      const list = await datastore.listAllModules();
      assertEquals(list.length, 1);
      assertEquals(list[0].name, "old");
    } finally {
      await cleanupDatabase(datastore);
      await s3.empty();
      Deno.env.delete("DRYRUN");
    }
  },
});

Deno.test({
  name: "inactive modules cleanup old with errored build",
  async fn() {
    try {
      await datastore.saveModule(utest);
      await datastore.createBuild({
        options: {
          moduleName: "old",
          type: "github",
          repository: "wperron/testing",
          ref: "0.4.0",
          version: "0.4.0",
        },
        status: "error",
        message: "bla bla bla",
        created_at: new Date(),
      });

      Deno.env.set("DRYRUN", "");

      await handler(
        createScheduledEvent(),
        createContext(),
      );

      const list = await datastore.listAllModules();
      assert(list.length === 0);
    } finally {
      await cleanupDatabase(datastore);
      await s3.empty();
      Deno.env.delete("DRYRUN");
    }
  },
});
