// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.
import { handler } from "./get.ts";
import {
  cleanupDatabase,
  createAPIGatewayProxyEventV2,
  createContext,
} from "../../utils/test_utils.ts";
import { assertEquals } from "../../test_deps.ts";
import { Database as Datastore } from "../../utils/datastore_database.ts";

const datastore = new Datastore();

Deno.test({
  name: "`/modules/:name` success",
  async fn() {
    try {
      await datastore.saveModule({
        name: "ltest",
        description: "ltest repo",
        repo_id: 274939732,
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
    } finally {
      await cleanupDatabase(datastore);
    }
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
