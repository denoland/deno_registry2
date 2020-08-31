import { handler } from "./github.ts";
import {
  createJSONWebhookEvent,
  createJSONWebhookWebFormEvent,
  createContext,
} from "../../utils/test_utils.ts";
import { Database } from "../../utils/database.ts";
import { assertEquals, readJson } from "../../test_deps.ts";
import { getMeta, s3 } from "../../utils/storage.ts";
const database = new Database(Deno.env.get("MONGO_URI")!);

const decoder = new TextDecoder();

const pingevent = await readJson("./api/webhook/testdata/pingevent.json");
const pingeventforbiddent = await readJson(
  "./api/webhook/testdata/pingeventforbidden.json",
);
const urlendodedpingevent = await Deno.readTextFile(
  "./api/webhook/testdata/pingevent.txt",
);

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

    // Check that no versions.json file exists
    assertEquals(await getMeta("ltest-2", "versions.json"), undefined);

    // Check that no builds are queued
    assertEquals(await database._builds.find({}), []);

    // Check that there is no module entry in the database
    assertEquals(await database.getModule("ltest-2"), null);
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
  name: "ping event forbidden name",
  async fn() {
    // Send ping event
    const resp = await handler(
      createJSONWebhookEvent(
        "ping",
        "/webhook/gh/frisbee",
        pingeventforbiddent,
        { name: "frisbee" },
        {},
      ),
      createContext(),
    );
    assertEquals(resp, {
      body: '{"success":false,"error":"found forbidden word in module name"}',
      headers: {
        "content-type": "application/json",
      },
      statusCode: 400,
    });

    // Check that no versions.json file exists
    assertEquals(await getMeta("frisbee", "versions.json"), undefined);

    // Check that no builds are queued
    assertEquals(await database._builds.find({}), []);

    // Check that there is no module entry in the database
    assertEquals(await database.getModule("frisbee"), null);
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
        owner: "luca-rand",
        repo: "testing",
        description: "Move along, just for testing",
        star_count: 2,
        is_unlisted: false,
      },
    );

    // Check that a versions.json file was created
    assertEquals(
      JSON.parse(decoder.decode(await getMeta("ltest2", "versions.json"))),
      { latest: null, versions: [] },
    );

    // Check that no new build was queued
    assertEquals(await database._builds.find({}), []);

    // Clean up
    await s3.deleteObject("ltest2/meta/versions.json");
    await database._modules.deleteMany({});
  },
});

Deno.test({
  name: "ping event success - web form",
  async fn() {
    // Send ping event
    const resp = await handler(
      createJSONWebhookWebFormEvent(
        "ping",
        "/webhook/gh/ltest2",
        btoa(urlendodedpingevent),
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
        owner: "luca-rand",
        repo: "testing",
        description: "Move along, just for testing",
        star_count: 2,
        is_unlisted: false,
      },
    );

    // Check that a versions.json file was created
    assertEquals(
      JSON.parse(decoder.decode(await getMeta("ltest2", "versions.json"))),
      { latest: null, versions: [] },
    );

    // Check that no new build was queued
    assertEquals(await database._builds.find({}), []);

    // Clean up
    await s3.deleteObject("ltest2/meta/versions.json");
    await database._modules.deleteMany({});
  },
});

Deno.test({
  name: "ping event max registered to repository",
  async fn() {
    await database.saveModule({
      name: "ltest2",
      type: "github",
      owner: "luca-rand",
      repo: "testing",
      description: "",
      star_count: 4,
      is_unlisted: false,
    });
    await database.saveModule({
      name: "ltest3",
      type: "github",
      owner: "luca-rand",
      repo: "testing",
      description: "",
      star_count: 4,
      is_unlisted: false,
    });
    await database.saveModule({
      name: "ltest4",
      type: "github",
      owner: "luca-rand",
      repo: "testing",
      description: "",
      star_count: 4,
      is_unlisted: false,
    });

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
          '{"success":false,"error":"Max number of modules for one repository (3) has been reached. Please contact ry@deno.land if you need more."}',
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

    // Clean up
    await database._modules.deleteMany({});
  },
});

Deno.test({
  name: "ping event wrong repository",
  async fn() {
    database.saveModule({
      name: "ltest",
      description: "testing things",
      owner: "luca-rand",
      repo: "testing2",
      star_count: 4,
      type: "github",
      is_unlisted: false,
    });

    // Send ping event
    const resp = await handler(
      createJSONWebhookEvent(
        "ping",
        "/webhook/gh/ltest",
        pingevent,
        { name: "ltest" },
        {},
      ),
      createContext(),
    );
    assertEquals(resp, {
      body:
        '{"success":false,"error":"module name is registered to a different repository"}',

      headers: {
        "content-type": "application/json",
      },
      statusCode: 409,
    });

    // Check that no versions.json file exists
    assertEquals(await getMeta("ltest", "versions.json"), undefined);

    // Check that no builds are queued
    assertEquals(await database._builds.find({}), []);

    // Check that there is no module entry in the database
    assertEquals(await database.getModule("ltest"), {
      name: "ltest",
      description: "testing things",
      owner: "luca-rand",
      repo: "testing2",
      star_count: 4,
      type: "github",
      is_unlisted: false,
    });

    // Cleanup
    await database._modules.deleteMany({});
  },
});

Deno.test({
  name: "ping event success capitalization",
  async fn() {
    database.saveModule({
      name: "ltest2",
      description: "testing things",
      owner: "lUca-rand",
      repo: "Testing",
      star_count: 4,
      type: "github",
      is_unlisted: false,
    });

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
        owner: "luca-rand",
        repo: "testing",
        description: "Move along, just for testing",
        star_count: 2,
        is_unlisted: false,
      },
    );

    // Check that a versions.json file was created
    assertEquals(
      JSON.parse(decoder.decode(await getMeta("ltest2", "versions.json"))),
      { latest: null, versions: [] },
    );

    // Check that no new build was queued
    assertEquals(await database._builds.find({}), []);

    // Clean up
    await s3.deleteObject("ltest2/meta/versions.json");
    await database._modules.deleteMany({});
  },
});
