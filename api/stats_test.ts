import { handler } from "./stats.ts";
import {
  createAPIGatewayProxyEventV2,
  createContext,
} from "../utils/test_utils.ts";
import { assertEquals } from "../test_deps.ts";
import { Database } from "../utils/database.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

Deno.test({
  name: "`/stats` success",
  async fn() {
    await database.saveModule({
      name: "ltest1",
      description: "ltest1 repo",
      owner: "luca-rand",
      repo: "testing",
      star_count: 50,
      type: "github",
      is_unlisted: false,
      created_at: new Date(2020, 1, 3),
    });

    await database.saveModule({
      name: "ltest2",
      description: "ltest2 repo",
      owner: "luca-rand",
      repo: "testing",
      star_count: 50,
      type: "github",
      is_unlisted: false,
      created_at: new Date(2020, 1, 1),
    });

    await database.saveModule({
      name: "ltest3",
      description: "ltest3 repo",
      owner: "luca-rand",
      repo: "testing",
      star_count: 50,
      type: "github",
      is_unlisted: false,
      created_at: new Date(2020, 1, 2),
    });

    await database.saveModule({
      name: "ltest4",
      description: "ltest4 repo",
      owner: "luca-rand",
      repo: "testing",
      star_count: 50,
      type: "github",
      is_unlisted: true,
      created_at: new Date(2020, 1, 3),
    });

    const res = await handler(
      createAPIGatewayProxyEventV2(
        "GET",
        "/stats",
        {},
      ),
      createContext(),
    );

    assertEquals(
      res,
      {
        body:
          '{"success":true,"data":{"recentlyAddedModules":[{"name":"ltest1","description":"ltest1 repo","star_count":50,"created_at":"2020-02-03T00:00:00.000Z"},{"name":"ltest3","description":"ltest3 repo","star_count":50,"created_at":"2020-02-02T00:00:00.000Z"},{"name":"ltest2","description":"ltest2 repo","star_count":50,"created_at":"2020-02-01T00:00:00.000Z"}]}}',
        headers: {
          "content-type": "application/json",
        },
        statusCode: 200,
      },
    );

    // Cleanup
    await database._modules.deleteMany({});
  },
});
