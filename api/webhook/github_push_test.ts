import { handler } from "./github.ts";
import {
  createJSONWebhookEvent,
  createJSONWebhookWebFormEvent,
  createContext,
} from "../../utils/test_utils.ts";
import { Database } from "../../utils/database.ts";
import { assertEquals, assert, readJson } from "../../test_deps.ts";
import { getMeta, s3, uploadMetaJson } from "../../utils/storage.ts";
const database = new Database(Deno.env.get("MONGO_URI")!);

const decoder = new TextDecoder();

const pushevent = await readJson("./api/webhook/testdata/pushevent.json");
const pusheventforbidden = await readJson(
  "./api/webhook/testdata/pusheventforbidden.json",
);
const pusheventBranch = await readJson(
  "./api/webhook/testdata/pushevent_branch.json",
);
const pusheventVersionPrefix = await readJson(
  "./api/webhook/testdata/pushevent_versionprefix.json",
);

Deno.test({
  name: "push event no name",
  async fn() {
    // Send push event
    const resp = await handler(
      createJSONWebhookEvent(
        "push",
        "/webhook/gh/",
        pushevent,
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
  name: "push event bad name",
  async fn() {
    // Send push event
    const resp = await handler(
      createJSONWebhookEvent(
        "push",
        "/webhook/gh/ltest-2",
        pushevent,
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
  name: "push event forbidden name",
  async fn() {
    // Send push event
    const resp = await handler(
      createJSONWebhookEvent(
        "push",
        "/webhook/gh/frisbee",
        pusheventforbidden,
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
  name: "push event max registered to repository",
  async fn() {
    await database.saveModule({
      name: "ltest2",
      type: "github",
      owner: "luca-rand",
      repo: "testing",
      description: "",
      star_count: 4,
      is_unlisted: false,
      created_at: new Date(2020, 1, 1),
    });
    await database.saveModule({
      name: "ltest3",
      type: "github",
      owner: "luca-rand",
      repo: "testing",
      description: "",
      star_count: 4,
      is_unlisted: false,
      created_at: new Date(2020, 1, 1),
    });
    await database.saveModule({
      name: "ltest4",
      type: "github",
      owner: "luca-rand",
      repo: "testing",
      description: "",
      star_count: 4,
      is_unlisted: false,
      created_at: new Date(2020, 1, 1),
    });

    // Send push event for ltest5
    assertEquals(
      await handler(
        createJSONWebhookEvent(
          "push",
          "/webhook/gh/ltest5",
          pushevent,
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
  name: "push event success",
  async fn() {
    // Send push event
    const resp = await handler(
      createJSONWebhookEvent(
        "push",
        "/webhook/gh/ltest2",
        pushevent,
        { name: "ltest2" },
        {},
      ),
      createContext(),
    );

    const builds = await database._builds.find({});

    // Check that a new build was queued
    assertEquals(builds.length, 1);
    assertEquals(
      builds[0],
      {
        _id: builds[0]._id,
        created_at: builds[0].created_at,
        options: {
          moduleName: "ltest2",
          type: "github",
          repository: "luca-rand/testing",
          ref: "0.0.7",
          version: "0.0.7",
        },
        status: "queued",
      },
    );

    assertEquals(resp, {
      body:
        `{"success":true,"data":{"module":"ltest2","version":"0.0.7","repository":"luca-rand/testing","status_url":"https://deno.land/status/${
          builds[0]._id.$oid
        }"}}`,
      headers: {
        "content-type": "application/json",
      },
      statusCode: 200,
    });

    const ltest2 = await database.getModule("ltest2");
    assert(ltest2);
    assert(ltest2.created_at <= new Date());
    ltest2.created_at = new Date(2020, 1, 1);

    // Check that the database entry
    assertEquals(ltest2, {
      name: "ltest2",
      type: "github",
      owner: "luca-rand",
      repo: "testing",
      description: "Move along, just for testing",
      star_count: 2,
      is_unlisted: false,
      created_at: new Date(2020, 1, 1),
    });

    // Check that no versions.json file was created
    assertEquals(await getMeta("ltest2", "versions.json"), undefined);

    // Clean up
    await database._builds.deleteMany({});
    await database._modules.deleteMany({});
  },
});

Deno.test({
  name: "push event not a tag",
  async fn() {
    // Send push event
    const resp = await handler(
      createJSONWebhookEvent(
        "push",
        "/webhook/gh/ltest2",
        pusheventBranch,
        { name: "ltest2" },
        {},
      ),
      createContext(),
    );
    assertEquals(resp, {
      body: '{"success":false,"info":"created ref is not tag"}',
      headers: {
        "content-type": "application/json",
      },
      statusCode: 200,
    });

    // Check that no versions.json file exists
    assertEquals(await getMeta("ltest2", "versions.json"), undefined);

    // Check that no builds are queued
    assertEquals(await database._builds.find({}), []);

    // Check that there is no module entry in the database
    assertEquals(await database.getModule("ltest2"), null);
  },
});

Deno.test({
  name: "push event version prefix no match",
  async fn() {
    // Send push event
    const resp = await handler(
      createJSONWebhookEvent(
        "push",
        "/webhook/gh/ltest2",
        pushevent,
        { name: "ltest2" },
        { version_prefix: "v" },
      ),
      createContext(),
    );
    assertEquals(resp, {
      body:
        '{"success":false,"info":"ignoring event as the version does not match the version prefix"}',
      headers: {
        "content-type": "application/json",
      },
      statusCode: 200,
    });

    // Check that no versions.json file exists
    assertEquals(await getMeta("ltest2", "versions.json"), undefined);

    // Check that no builds are queued
    assertEquals(await database._builds.find({}), []);

    // Check that there is no module entry in the database
    assertEquals(await database.getModule("ltest2"), null);
  },
});

Deno.test({
  name: "push event version prefix match",
  async fn() {
    // Send push event
    const resp = await handler(
      createJSONWebhookEvent(
        "push",
        "/webhook/gh/ltest2",
        pusheventVersionPrefix,
        { name: "ltest2" },
        { version_prefix: "v" },
      ),
      createContext(),
    );

    const builds = await database._builds.find({});

    // Check that a new build was queued
    assertEquals(builds.length, 1);
    assertEquals(
      builds[0],
      {
        _id: builds[0]._id,
        created_at: builds[0].created_at,
        options: {
          moduleName: "ltest2",
          type: "github",
          repository: "luca-rand/testing",
          ref: "v0.0.7",
          version: "0.0.7",
        },
        status: "queued",
      },
    );

    assertEquals(resp, {
      body:
        `{"success":true,"data":{"module":"ltest2","version":"0.0.7","repository":"luca-rand/testing","status_url":"https://deno.land/status/${
          builds[0]._id.$oid
        }"}}`,
      headers: {
        "content-type": "application/json",
      },
      statusCode: 200,
    });

    const ltest2 = await database.getModule("ltest2");
    assert(ltest2);
    assert(ltest2.created_at <= new Date());
    ltest2.created_at = new Date(2020, 1, 1);

    // Check that the database entry
    assertEquals(ltest2, {
      name: "ltest2",
      type: "github",
      owner: "luca-rand",
      repo: "testing",
      description: "Move along, just for testing",
      star_count: 2,
      is_unlisted: false,
      created_at: new Date(2020, 1, 1),
    });

    // Check that no versions.json file was created
    assertEquals(await getMeta("ltest2", "versions.json"), undefined);

    // Clean up
    await database._builds.deleteMany({});
    await database._modules.deleteMany({});
  },
});

Deno.test({
  name: "push event subdir invalid",
  async fn() {
    // Send push event
    assertEquals(
      await handler(
        createJSONWebhookEvent(
          "push",
          "/webhook/gh/ltest2",
          pushevent,
          { name: "ltest2" },
          { subdir: "/asd" },
        ),
        createContext(),
      ),
      {
        body:
          '{"success":false,"error":"provided sub directory is not valid as it starts with a /"}',
        headers: {
          "content-type": "application/json",
        },
        statusCode: 400,
      },
    );

    // Send push event
    assertEquals(
      await handler(
        createJSONWebhookEvent(
          "push",
          "/webhook/gh/ltest2",
          pushevent,
          { name: "ltest2" },
          { subdir: "asd" },
        ),
        createContext(),
      ),
      {
        body:
          '{"success":false,"error":"provided sub directory is not valid as it does not end with a /"}',
        headers: {
          "content-type": "application/json",
        },
        statusCode: 400,
      },
    );

    // Check that no versions.json file exists
    assertEquals(await getMeta("ltest2", "versions.json"), undefined);

    // Check that no builds are queued
    assertEquals(await database._builds.find({}), []);

    // Check that there is no module entry in the database
    assertEquals(await database.getModule("ltest2"), null);
  },
});

Deno.test({
  name: "push event subdir success",
  async fn() {
    // Send push event
    const resp = await handler(
      createJSONWebhookEvent(
        "push",
        "/webhook/gh/ltest2",
        pushevent,
        { name: "ltest2" },
        { subdir: "asd/" },
      ),
      createContext(),
    );

    const builds = await database._builds.find({});

    // Check that a new build was queued
    assertEquals(builds.length, 1);
    assertEquals(
      builds[0],
      {
        _id: builds[0]._id,
        created_at: builds[0].created_at,
        options: {
          moduleName: "ltest2",
          type: "github",
          repository: "luca-rand/testing",
          ref: "0.0.7",
          version: "0.0.7",
          subdir: "asd/",
        },
        status: "queued",
      },
    );

    assertEquals(resp, {
      body:
        `{"success":true,"data":{"module":"ltest2","version":"0.0.7","repository":"luca-rand/testing","status_url":"https://deno.land/status/${
          builds[0]._id.$oid
        }"}}`,
      headers: {
        "content-type": "application/json",
      },
      statusCode: 200,
    });

    const ltest2 = await database.getModule("ltest2");
    assert(ltest2);
    assert(ltest2.created_at <= new Date());
    ltest2.created_at = new Date(2020, 1, 1);

    // Check that the database entry
    assertEquals(ltest2, {
      name: "ltest2",
      type: "github",
      owner: "luca-rand",
      repo: "testing",
      description: "Move along, just for testing",
      star_count: 2,
      is_unlisted: false,
      created_at: new Date(2020, 1, 1),
    });

    // Check that no versions.json file was created
    assertEquals(await getMeta("ltest2", "versions.json"), undefined);

    // Clean up
    await database._builds.deleteMany({});
    await database._modules.deleteMany({});
  },
});

Deno.test({
  name: "push event already exists",
  async fn() {
    await uploadMetaJson(
      "ltest2",
      "versions.json",
      { latest: "0.0.7", versions: ["0.0.7"] },
    );

    // Send push event
    const resp = await handler(
      createJSONWebhookEvent(
        "push",
        "/webhook/gh/ltest2",
        pushevent,
        { name: "ltest2" },
        {},
      ),
      createContext(),
    );
    assertEquals(resp, {
      body: '{"success":false,"error":"version already exists"}',
      headers: {
        "content-type": "application/json",
      },
      statusCode: 400,
    });

    const ltest2 = await database.getModule("ltest2");
    assert(ltest2);
    assert(ltest2.created_at <= new Date());
    ltest2.created_at = new Date(2020, 1, 1);

    // Check that the database entry
    assertEquals(ltest2, {
      name: "ltest2",
      type: "github",
      owner: "luca-rand",
      repo: "testing",
      description: "Move along, just for testing",
      star_count: 2,
      is_unlisted: false,
      created_at: new Date(2020, 1, 1),
    });

    // Check that versions.json was not changed
    assertEquals(
      JSON.parse(decoder.decode(await getMeta("ltest2", "versions.json"))),
      { latest: "0.0.7", versions: ["0.0.7"] },
    );

    // Check that no new build was queued
    assertEquals(await database._builds.find({}), []);

    // Clean up
    await s3.deleteObject("ltest2/meta/versions.json");
    await database._modules.deleteMany({});
  },
});

Deno.test({
  name: "push event already queued",
  async fn() {
    await database.createBuild({
      options: {
        moduleName: "ltest2",
        ref: "0.0.7",
        repository: "luca-rand/testing",
        type: "github",
        version: "0.0.7",
      },
      status: "queued",
    });

    // Send push event
    const resp = await handler(
      createJSONWebhookEvent(
        "push",
        "/webhook/gh/ltest2",
        pushevent,
        { name: "ltest2" },
        {},
      ),
      createContext(),
    );
    assertEquals(resp, {
      body:
        '{"success":false,"error":"this module version is already being published"}',
      headers: {
        "content-type": "application/json",
      },
      statusCode: 400,
    });

    // Check that the database entry was created
    assertEquals(await database.getModule("ltest2"), {
      name: "ltest2",
      type: "github",
      owner: "luca-rand",
      repo: "testing",
      description: "Move along, just for testing",
      star_count: 2,
      is_unlisted: false,
    });

    // Clean up
    await s3.deleteObject("ltest2/meta/versions.json");
    await database._modules.deleteMany({});
    await database._builds.deleteMany({});
  },
});
