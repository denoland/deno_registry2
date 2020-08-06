import { handler } from "./github.ts";
import {
  createJSONWebhookEvent,
  createContext,
} from "../../utils/test_utils.ts";
import { Database } from "../../utils/database.ts";
import { assertEquals, readJson } from "../../test_deps.ts";
import { getMeta } from "../../utils/storage.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

const decoder = new TextDecoder();

const pingevent = await readJson("./api/webhook/testdata/pingevent.json");

Deno.test({
  name: "ping event no name",
  async fn() {
    // Send ping event
    const resp = await handler(
      createJSONWebhookEvent(
        "ping",
        "/webhook/gh/",
        pingevent,
        { name: "" },
        {},
      ),
      createContext(),
    );
    assertEquals(resp, {
      body: '{"success":false,"error":"no module name specified"}',

      headers: {
        "content-type": "application/json",
      },
      statusCode: 400,
    });
  },
});

Deno.test({
  name: "ping event bad name",
  async fn() {
    // Send ping event
    const resp = await handler(
      createJSONWebhookEvent(
        "ping",
        "/webhook/gh/ltest-2",
        pingevent,
        { name: "ltest-2" },
        {},
      ),
      createContext(),
    );
    assertEquals(resp, {
      body: '{"success":false,"error":"module name is not valid"}',
      headers: {
        "content-type": "application/json",
      },
      statusCode: 400,
    });

    // Check that no versions.json file exists
    assertEquals(await getMeta("ltest-2", "versions.json"), undefined);

    // Check that no builds are queued
    assertEquals(await database._builds.find({}), []);

    // Check that there is no module entry in the database
    assertEquals(await database.getModule("ltest-2"), null);
  },
});

Deno.test({
  name: "ping event success",
  async fn() {
    // Send ping event
    const resp = await handler(
      createJSONWebhookEvent(
        "ping",
        "/webhook/gh/ltest2",
        pingevent,
        { name: "ltest2" },
        {},
      ),
      createContext(),
    );
    assertEquals(resp, {
      body:
        '{"success":true,"data":{"module":"ltest2","repository":"luca-rand/testing"}}',
      headers: {
        "content-type": "application/json",
      },
      statusCode: 200,
    });

    // Check that the database entry
    assertEquals(
      await database.getModule("ltest2"),
      {
        name: "ltest2",
        type: "github",
        repository: "luca-rand/testing",
        description: "Move along, just for testing",
        star_count: 2,
      },
    );

    // Check that a versions.json file was created
    assertEquals(
      JSON.parse(decoder.decode(await getMeta("ltest2", "versions.json"))),
      { latest: null, versions: [] },
    );

    // Check that no new build was queued
    assertEquals(await database._builds.find({}), []);
  },
});

Deno.test({
  name: "ping event max registered to repository",
  async fn() {
    // Send ping event for ltest3
    assertEquals(
      await handler(
        createJSONWebhookEvent(
          "ping",
          "/webhook/gh/ltest3",
          pingevent,
          { name: "ltest3" },
          {},
        ),
        createContext(),
      ),
      {
        body:
          '{"success":true,"data":{"module":"ltest3","repository":"luca-rand/testing"}}',
        headers: {
          "content-type": "application/json",
        },
        statusCode: 200,
      },
    );

    // Send ping event for ltest4
    assertEquals(
      await handler(
        createJSONWebhookEvent(
          "ping",
          "/webhook/gh/ltest4",
          pingevent,
          { name: "ltest4" },
          {},
        ),
        createContext(),
      ),
      {
        body:
          '{"success":true,"data":{"module":"ltest4","repository":"luca-rand/testing"}}',
        headers: {
          "content-type": "application/json",
        },
        statusCode: 200,
      },
    );

    // Send ping event for ltest5
    assertEquals(
      await handler(
        createJSONWebhookEvent(
          "ping",
          "/webhook/gh/ltest5",
          pingevent,
          { name: "ltest5" },
          {},
        ),
        createContext(),
      ),
      {
        body:
          '{"success":false,"error":"max number of modules for one repository (3) has been reached"}',
        headers: {
          "content-type": "application/json",
        },
        statusCode: 400,
      },
    );

    // Check that no versions.json file exists
    assertEquals(await getMeta("ltest5", "versions.json"), undefined);

    // Check that there is no module entry in the database
    assertEquals(await database.getModule("ltest5"), null);

    // Check that builds were queued
    assertEquals(await database._builds.find({}), []);
  },
});
