// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.
import { handler } from "./get.ts";
import {
  cleanupDatabase,
  createAPIGatewayProxyEventV2,
  createContext,
} from "../../utils/test_utils.ts";
import { assertEquals } from "../../test_deps.ts";
import { Database } from "../../utils/database.ts";
import { s3 } from "../../utils/storage.ts";
import { Database as Datastore } from "../../utils/datastore_database.ts";

const datastore = new Datastore();
const database = await Database.connect(Deno.env.get("MONGO_URI")!);

Deno.test({
  name: "`/builds/:id` success",
  async fn() {
    try {
      const id = await datastore.createBuild({
        options: {
          moduleName: "ltest",
          ref: "0.0.7",
          repository: "luca-rand/testing",
          type: "github",
          version: "0.0.7",
        },
        status: "queued",
      });

      assertEquals(
        await handler(
          createAPIGatewayProxyEventV2("GET", `/builds/${id}`, {
            pathParameters: {
              id,
            },
          }),
          createContext(),
        ),
        {
          body: `{"success":true,"data":${
            JSON.stringify({ build: await datastore.getBuild(id) })
          }}`,
          headers: {
            "content-type": "application/json",
          },
          statusCode: 200,
        },
      );
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "`/builds/:id` missing id",
  async fn() {
    assertEquals(
      await handler(
        createAPIGatewayProxyEventV2("GET", `/builds/`, {
          pathParameters: {},
        }),
        createContext(),
      ),
      {
        body: `{"success":false,"error":"no build id provided"}`,
        headers: {
          "content-type": "application/json",
        },
        statusCode: 400,
      },
    );
  },
});

Deno.test({
  name: "`/builds/:id` invalid id",
  async fn() {
    assertEquals(
      await handler(
        createAPIGatewayProxyEventV2("GET", `/builds/xdxdxd`, {
          pathParameters: {
            id: "xdxdxd",
          },
        }),
        createContext(),
      ),
      {
        body: `{"success":false,"error":"invalid build id"}`,
        headers: {
          "content-type": "application/json",
        },
        statusCode: 400,
      },
    );
  },
});

Deno.test({
  name: "`/builds/:id` not found",
  async fn() {
    assertEquals(
      await handler(
        createAPIGatewayProxyEventV2(
          "GET",
          `/builds/5f2d7413009a862e00e3ae31`,
          {
            pathParameters: {
              id: "5f2d7413009a862e00e3ae31",
            },
          },
        ),
        createContext(),
      ),
      {
        body: `{"success":false,"error":"build not found"}`,
        headers: {
          "content-type": "application/json",
        },
        statusCode: 404,
      },
    );
  },
});
