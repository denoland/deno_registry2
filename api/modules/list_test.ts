import { handler } from "./list.ts";
import {
  createAPIGatewayProxyEventV2,
  createContext,
} from "../../utils/test_utils.ts";
import { assertEquals } from "../../test_deps.ts";
import { Database } from "../../utils/database.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

Deno.test({
  name: "`/modules`success",
  async fn() {
    for (let i = 0; i < 5; i++) {
      await database.saveModule({
        name: `ltest${i}`,
        description: "ltest repo",
        repository: "luca-rand/testing",
        star_count: i,
        type: "github",
        is_unlisted: false,
      });
    }

    const res = await handler(
      createAPIGatewayProxyEventV2("GET", "/modules", {}),
      createContext(),
    );

    console.log((res as any).body);

    assertEquals(
      res,
      {
        body:
          '{"success":true,"data":{"total_count":5,"results":[{"name":"ltest4","description":"ltest repo","star_count":4},{"name":"ltest3","description":"ltest repo","star_count":3},{"name":"ltest2","description":"ltest repo","star_count":2},{"name":"ltest1","description":"ltest repo","star_count":1},{"name":"ltest0","description":"ltest repo","star_count":0}]}}',
        headers: {
          "content-type": "application/json",
        },
        statusCode: 200,
      },
    );

    assertEquals(
      await handler(
        createAPIGatewayProxyEventV2("GET", "/modules", {
          queryStringParameters: {
            page: "2",
            limit: "2",
          },
        }),
        createContext(),
      ),
      {
        body:
          '{"success":true,"data":{"total_count":5,"results":[{"name":"ltest2","description":"ltest repo","star_count":2},{"name":"ltest1","description":"ltest repo","star_count":1}]}}',
        headers: {
          "content-type": "application/json",
        },
        statusCode: 200,
      },
    );

    assertEquals(
      await handler(
        createAPIGatewayProxyEventV2("GET", "/modules", {
          queryStringParameters: {
            page: "5",
            limit: "2",
          },
        }),
        createContext(),
      ),
      {
        body: '{"success":true,"data":{"total_count":5,"results":[]}}',
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
  name: "`/modules` limit & page out of bounds",
  async fn() {
    for (let i = 0; i < 5; i++) {
      await database.saveModule({
        name: `ltest${i}`,
        description: "ltest repo",
        repository: "luca-rand/testing",
        star_count: i,
        type: "github",
        is_unlisted: false,
      });
    }

    assertEquals(
      await handler(
        createAPIGatewayProxyEventV2("GET", "/modules", {
          queryStringParameters: {
            page: "0",
          },
        }),
        createContext(),
      ),
      {
        body:
          '{"success":false,"error":"the page number must not be lower than 1"}',
        headers: {
          "content-type": "application/json",
        },
        statusCode: 400,
      },
    );

    assertEquals(
      await handler(
        createAPIGatewayProxyEventV2("GET", "/modules", {
          queryStringParameters: {
            page: "-1",
          },
        }),
        createContext(),
      ),
      {
        body:
          '{"success":false,"error":"the page number must not be lower than 1"}',
        headers: {
          "content-type": "application/json",
        },
        statusCode: 400,
      },
    );

    assertEquals(
      await handler(
        createAPIGatewayProxyEventV2("GET", "/modules", {
          queryStringParameters: {
            limit: "0",
          },
        }),
        createContext(),
      ),
      {
        body:
          '{"success":false,"error":"the limit may not be larger than 100 or smaller than 1"}',
        headers: {
          "content-type": "application/json",
        },
        statusCode: 400,
      },
    );

    assertEquals(
      await handler(
        createAPIGatewayProxyEventV2("GET", "/modules", {
          queryStringParameters: {
            limit: "-1",
          },
        }),
        createContext(),
      ),
      {
        body:
          '{"success":false,"error":"the limit may not be larger than 100 or smaller than 1"}',
        headers: {
          "content-type": "application/json",
        },
        statusCode: 400,
      },
    );

    assertEquals(
      await handler(
        createAPIGatewayProxyEventV2("GET", "/modules", {
          queryStringParameters: {
            limit: "101",
          },
        }),
        createContext(),
      ),
      {
        body:
          '{"success":false,"error":"the limit may not be larger than 100 or smaller than 1"}',
        headers: {
          "content-type": "application/json",
        },
        statusCode: 400,
      },
    );

    // Cleanup
    await database._modules.deleteMany({});
  },
});
