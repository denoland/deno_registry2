import { assert } from "../../test_deps.ts";
import {
  cleanupDatabase,
  createContext,
  createScheduledEvent,
} from "../../utils/test_utils.ts";
import { handler } from "./stargazers.ts";
import { Database, Module } from "../../utils/database.ts";
import { GitHub } from "../../utils/github.ts";
import { assertEquals } from "https://deno.land/std@0.69.0/testing/asserts.ts";
import { s3 } from "../../utils/storage.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);
const gh = new GitHub();

const ltest: Module = {
  name: "ltest",
  description: "Testing all the things!",
  repoId: 274939732,
  type: "github",
  owner: "luca-rand",
  repo: "testing",
  star_count: 0, // real number is 2 atm
  is_unlisted: false,
  created_at: new Date(2020, 1, 1),
};

const utest: Module = {
  name: "unlisted_module",
  description: "Testing all the things! -- unlisted",
  repoId: 70289105,
  type: "github",
  owner: "wperron",
  repo: "testing",
  star_count: 0,
  is_unlisted: true,
  created_at: new Date(2020, 1, 1),
};

Deno.test({
  name: "crawl stargazers",
  async fn() {
    try {
      await database.saveModule(ltest);
      await database.saveModule(utest);

      await handler(
        createScheduledEvent(),
        createContext(),
      );

      const updated = await database.getModule(ltest.name);
      assert(updated?.star_count ?? 0 >= 1);
      assertEquals(updated?.created_at, ltest.created_at);
    } finally {
      await cleanupDatabase(database);
      await s3.empty();
    }
  },
});
