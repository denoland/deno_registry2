import { handler } from "./get.ts";
import {
  createAPIGatewayProxyEventV2,
  createContext,
} from "../../utils/test_utils.ts";
import { assertEquals } from "../../test_deps.ts";
import { Database } from "../../utils/database.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

Deno.test({
  name: "`/modules/:name` success",
  async fn() {
    await database.saveModule({
      name: "ltest",
      description: "ltest repo",
      owner: "luca-rand",
      repo: "testing",
      star_count: 50,
      type: "github",
      is_unlisted: false,
      created_at: new Date(2020, 1, 1),
    });

    const res = await handler(
      createAPIGatewayProxyEventV2(
        "GET",
        "/modules/ltest",
        { pathParameters: { name: "ltest" } },
      ),
      createContext(),
    );

    assertEquals(
      res,
      {
        body:
          '{"success":true,"data":{"name":"ltest","description":"ltest repo","star_count":50}}',
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

Deno.test({
  name: "`/modules/:name` not found",
  async fn() {
    const res = await handler(
      createAPIGatewayProxyEventV2(
        "GET",
        "/modules/ltest",
        { pathParameters: { name: "ltest" } },
      ),
      createContext(),
    );

    assertEquals(
      res,
      {
        body: '{"success":false,"error":"module not found"}',
        headers: {
          "content-type": "application/json",
        },
        statusCode: 404,
      },
    );
  },
});
