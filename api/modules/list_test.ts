import { handler } from "./list.ts";
import {
  cleanupDatabase,
  createAPIGatewayProxyEventV2,
  createContext,
} from "../../utils/test_utils.ts";
import { assert, assertEquals } from "../../test_deps.ts";
import { Database } from "../../utils/database.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

Deno.test({
  name: "`/modules` success",
  async fn() {
    try {
      for (let i = 0; i < 5; i++) {
        await database.saveModule({
          name: `ltest${i}`,
          description: "ltest repo",
          repo_id: 274939732,
          owner: "luca-rand",
          repo: "testing",
          star_count: i,
          type: "github",
          is_unlisted: false,
          created_at: new Date(2020, 1, 1),
        });
      }

      const res = await handler(
        createAPIGatewayProxyEventV2("GET", "/modules", {}),
        createContext(),
      );

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
          createAPIGatewayProxyEventV2("GET", "/modules?simple=1", {
            queryStringParameters: {
              simple: "1",
            },
          }),
          createContext(),
        ),
        {
          body: '["ltest0","ltest1","ltest2","ltest3","ltest4"]',
          headers: {
            "cache-control": "max-age=60, must-revalidate",
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
    } finally {
      await cleanupDatabase(database);
    }
  },
});

Deno.test({
  name: "`/modules` limit & page out of bounds",
  async fn() {
    try {
      for (let i = 0; i < 5; i++) {
        await database.saveModule({
          name: `ltest${i}`,
          description: "ltest repo",
          repo_id: 274939732,
          owner: "luca-rand",
          repo: "testing",
          star_count: i,
          type: "github",
          is_unlisted: false,
          created_at: new Date(2020, 1, 1),
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
    } finally {
      await cleanupDatabase(database);
    }
  },
});

Deno.test({
  name: "`/modules` sort order",
  async fn() {
    try {
      for (let i = 0; i < 5; i++) {
        await database.saveModule({
          name: `ltest${i}`,
          description: "ltest repo",
          repo_id: 274939732,
          owner: "luca-rand",
          repo: "testing",
          star_count: i, // varying number of stars
          type: "github",
          is_unlisted: false,
          created_at: new Date(2020, 1, i),
        } // varying creation dates
        );
      }

      let res = await handler(
        createAPIGatewayProxyEventV2("GET", "/modules", {
          queryStringParameters: {
            limit: "1",
          },
        }),
        createContext(),
      );

      // default value
      assertEquals(
        res,
        {
          body:
            '{"success":true,"data":{"total_count":5,"results":[{"name":"ltest4","description":"ltest repo","star_count":4}]}}',
          headers: {
            "content-type": "application/json",
          },
          statusCode: 200,
        },
      );

      res = await handler(
        createAPIGatewayProxyEventV2("GET", "/modules", {
          queryStringParameters: {
            limit: "1",
            sort: "stars",
          },
        }),
        createContext(),
      );

      // star count
      assertEquals(
        res,
        {
          body:
            '{"success":true,"data":{"total_count":5,"results":[{"name":"ltest4","description":"ltest repo","star_count":4}]}}',
          headers: {
            "content-type": "application/json",
          },
          statusCode: 200,
        },
      );

      res = await handler(
        createAPIGatewayProxyEventV2("GET", "/modules", {
          queryStringParameters: {
            limit: "1",
            sort: "oldest",
          },
        }),
        createContext(),
      );

      // oldest modules
      assertEquals(
        res,
        {
          body:
            '{"success":true,"data":{"total_count":5,"results":[{"name":"ltest0","description":"ltest repo","star_count":0}]}}',
          headers: {
            "content-type": "application/json",
          },
          statusCode: 200,
        },
      );

      res = await handler(
        createAPIGatewayProxyEventV2("GET", "/modules", {
          queryStringParameters: {
            limit: "1",
            sort: "newest",
          },
        }),
        createContext(),
      );

      // newest modules
      assertEquals(
        res,
        {
          body:
            '{"success":true,"data":{"total_count":5,"results":[{"name":"ltest4","description":"ltest repo","star_count":4}]}}',
          headers: {
            "content-type": "application/json",
          },
          statusCode: 200,
        },
      );
    } finally {
      await cleanupDatabase(database);
    }
  },
});

Deno.test({
  name: "`/modules` random sort order",
  async fn() {
    try {
      for (let i = 0; i < 5; i++) {
        await database.saveModule({
          name: `ltest${i}`,
          description: "ltest repo",
          repo_id: 274939732,
          owner: "luca-rand",
          repo: "testing",
          star_count: i,
          type: "github",
          is_unlisted: false,
          created_at: new Date(2020, 1, 1),
        });

        const res = await handler(
          createAPIGatewayProxyEventV2("GET", "/modules", {
            queryStringParameters: {
              sort: "random",
            },
          }),
          createContext(),
          // deno-lint-ignore no-explicit-any
        ) as any;

        assert(res);
        assertEquals(res.statusCode, 200);
      }
    } finally {
      await cleanupDatabase(database);
    }
  },
});

Deno.test({
  name: "`/modules` unknow sort order",
  async fn() {
    try {
      for (let i = 0; i < 5; i++) {
        await database.saveModule({
          name: `ltest${i}`,
          description: "ltest repo",
          repo_id: 274939732,
          owner: "luca-rand",
          repo: "testing",
          star_count: i,
          type: "github",
          is_unlisted: false,
          created_at: new Date(2020, 1, 1),
        });
      }

      assertEquals(
        await handler(
          createAPIGatewayProxyEventV2("GET", "/modules", {
            queryStringParameters: {
              sort: "foobar",
            },
          }),
          createContext(),
        ),
        {
          body:
            '{"success":false,"error":"the sort order must be one of stars, newest, oldest, random"}',
          headers: {
            "content-type": "application/json",
          },
          statusCode: 400,
        },
      );
    } finally {
      await cleanupDatabase(database);
    }
  },
});
