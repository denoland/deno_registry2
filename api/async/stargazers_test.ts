import { assert } from "../../test_deps.ts";
import {
  createContext,
  createScheduledEvent,
} from "../../utils/test_utils.ts";
import { handler } from "./stargazers.ts";
import { Database, Module } from "../../utils/database.ts";
import { GitHub } from "../../utils/github.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);
const gh = new GitHub();

const ltest: Module = {
  name: "ltest",
  description: "Testing all the things!",
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
    await database.saveModule(ltest);
    await database.saveModule(utest);

    await handler(
      createScheduledEvent(),
      createContext(),
    );

    const updated = await database.getModule(ltest.name);
    assert(updated?.star_count ?? 0 >= 1);

    // Cleanup
    await database._modules.deleteMany({});
  },
});
