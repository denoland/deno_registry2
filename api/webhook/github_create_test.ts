// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.
import { handler } from "./github.ts";
import {
  cleanupDatabase,
  createContext,
  createJSONWebhookEvent,
  createJSONWebhookWebFormEvent,
} from "../../utils/test_utils.ts";
import { Database } from "../../utils/database.ts";
import { assert, assertEquals } from "../../test_deps.ts";
import { getMeta, s3, uploadMetaJson } from "../../utils/storage.ts";
import { Database as Datastore } from "../../utils/datastore_database.ts";

const datastore = new Datastore();
const database = await Database.connect(Deno.env.get("MONGO_URI")!);

const decoder = new TextDecoder();

const createevent = JSON.parse(
  await Deno.readTextFile("./api/webhook/testdata/createevent.json"),
);
const createeventforbidden = JSON.parse(
  await Deno.readTextFile(
    "./api/webhook/testdata/createeventforbidden.json",
  ),
);
const urlencodedcreateevent = await Deno.readTextFile(
  "./api/webhook/testdata/createevent.txt",
);
const createeventBranch = JSON.parse(
  await Deno.readTextFile(
    "./api/webhook/testdata/createevent_branch.json",
  ),
);
const createeventVersionPrefix = JSON.parse(
  await Deno.readTextFile(
    "./api/webhook/testdata/createevent_versionprefix.json",
  ),
);

Deno.test({
  name: "create event no name",
  async fn() {
    try {
      // Send create event
      const resp = await handler(
        createJSONWebhookEvent(
          "create",
          "/webhook/gh/",
          createevent,
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
    } finally {
      await cleanupDatabase(database, datastore);
    }
  },
});

Deno.test({
  name: "create event bad name",
  async fn() {
    try {
      // Send create event
      const resp = await handler(
        createJSONWebhookEvent(
          "create",
          "/webhook/gh/ltest-2",
          createevent,
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
      assertEquals(await datastore.listAllBuilds(), []);

      // Check that there is no module entry in the database
      assertEquals(await database.getModule("ltest-2"), null);
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event forbidden name",
  async fn() {
    try {
      // Send create event
      const resp = await handler(
        createJSONWebhookEvent(
          "create",
          "/webhook/gh/frisbee",
          createeventforbidden,
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
      assertEquals(await datastore.listAllBuilds(), []);

      // Check that there is no module entry in the database
      assertEquals(await database.getModule("frisbee"), null);
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event max registered to repository",
  async fn() {
    try {
      await database.saveModule({
        name: "ltest2",
        type: "github",
        repo_id: 274939732,
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
        repo_id: 274939732,
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
        repo_id: 274939732,
        owner: "luca-rand",
        repo: "testing",
        description: "",
        star_count: 4,
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });

      // Send create event for ltest5
      assertEquals(
        await handler(
          createJSONWebhookEvent(
            "create",
            "/webhook/gh/ltest5",
            createevent,
            { name: "ltest5" },
            {},
          ),
          createContext(),
        ),
        {
          body:
            '{"success":false,"error":"Max number of modules for one repository (3) has been reached. Please contact modules@deno.com if you need more."}',
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
      assertEquals(await datastore.listAllBuilds(), []);
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event max registered to repository",
  async fn() {
    try {
      for (let i = 0; i < 15; i++) {
        await database.saveModule({
          name: `ltest${i + 2}`,
          type: "github",
          repo_id: i,
          owner: "luca-rand",
          repo: `testing${i + 2}`,
          description: "",
          star_count: 4,
          is_unlisted: false,
          created_at: new Date(2020, 1, 1),
        });
      }

      // Send create event for ltest5
      assertEquals(
        await handler(
          createJSONWebhookEvent(
            "create",
            "/webhook/gh/ltest17",
            createevent,
            { name: "ltest17" },
            {},
          ),
          createContext(),
        ),
        {
          body:
            '{"success":false,"error":"Max number of modules for one user/org (15) has been reached. Please contact modules@deno.com if you need more."}',
          headers: {
            "content-type": "application/json",
          },
          statusCode: 400,
        },
      );

      // Check that no versions.json file exists
      assertEquals(await getMeta("ltest17", "versions.json"), undefined);

      // Check that there is no module entry in the database
      assertEquals(await database.getModule("ltest17"), null);

      // Check that builds were queued
      assertEquals(await datastore.listAllBuilds(), []);

      // Clean up
      await database._modules.deleteMany({});
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event max registered to repository with dynamic owner quota",
  async fn() {
    try {
      await datastore.saveOwnerQuota({
        owner: "luca-rand",
        type: "github",
        max_modules: 7,
        blocked: false,
      });

      for (let i = 0; i < 7; i++) {
        await database.saveModule({
          name: `ltest${i + 2}`,
          type: "github",
          repo_id: i,
          owner: "luca-rand",
          repo: `testing${i + 2}`,
          description: "",
          star_count: 4,
          is_unlisted: false,
          created_at: new Date(2020, 1, 1),
        });
      }

      // Send create event for ltest5
      assertEquals(
        await handler(
          createJSONWebhookEvent(
            "create",
            "/webhook/gh/ltest9",
            createevent,
            { name: "ltest9" },
            {},
          ),
          createContext(),
        ),
        {
          body:
            '{"success":false,"error":"Max number of modules for one user/org (7) has been reached. Please contact modules@deno.com if you need more."}',
          headers: {
            "content-type": "application/json",
          },
          statusCode: 400,
        },
      );

      // Check that no versions.json file exists
      assertEquals(await getMeta("ltest9", "versions.json"), undefined);

      // Check that there is no module entry in the database
      assertEquals(await database.getModule("ltest9"), null);

      // Check that builds were queued
      assertEquals(await datastore.listAllBuilds(), []);
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event success",
  async fn() {
    try {
      // Send create event
      const resp = await handler(
        createJSONWebhookEvent(
          "create",
          "/webhook/gh/ltest2",
          createevent,
          { name: "ltest2" },
          {},
        ),
        createContext(),
      );

      const builds = await datastore.listAllBuilds();

      // Check that a new build was queued
      assertEquals(builds.length, 1);
      assertEquals(
        builds[0],
        {
          id: builds[0].id,
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
            builds[0].id
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
        repo_id: 274939732,
        owner: "luca-rand",
        repo: "testing",
        description: "Move along, just for testing",
        star_count: 2,
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });

      // Check that no versions.json file was created
      assertEquals(await getMeta("ltest2", "versions.json"), undefined);
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event success - web form",
  async fn() {
    try {
      // Send create event
      const resp = await handler(
        createJSONWebhookWebFormEvent(
          "create",
          "/webhook/gh/ltest2",
          btoa(urlencodedcreateevent),
          { name: "ltest2" },
          {},
        ),
        createContext(),
      );

      const builds = await datastore.listAllBuilds();

      // Check that a new build was queued
      assertEquals(builds.length, 1);
      assertEquals(
        builds[0],
        {
          id: builds[0].id,
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
            builds[0].id
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
        repo_id: 274939732,
        owner: "luca-rand",
        repo: "testing",
        description: "Move along, just for testing",
        star_count: 2,
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });

      // Check that no versions.json file was created
      assertEquals(await getMeta("ltest2", "versions.json"), undefined);
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event not a tag",
  async fn() {
    try {
      // Send create event
      const resp = await handler(
        createJSONWebhookEvent(
          "create",
          "/webhook/gh/ltest2",
          createeventBranch,
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
      assertEquals(await datastore.listAllBuilds(), []);

      // Check that there is no module entry in the database
      assertEquals(await database.getModule("ltest2"), null);
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event version prefix no match",
  async fn() {
    try {
      // Send create event
      const resp = await handler(
        createJSONWebhookEvent(
          "create",
          "/webhook/gh/ltest2",
          createevent,
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
      assertEquals(await datastore.listAllBuilds(), []);

      // Check that there is no module entry in the database
      assertEquals(await database.getModule("ltest2"), null);
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event version prefix match",
  async fn() {
    try {
      // Send create event
      const resp = await handler(
        createJSONWebhookEvent(
          "create",
          "/webhook/gh/ltest2",
          createeventVersionPrefix,
          { name: "ltest2" },
          { version_prefix: "v" },
        ),
        createContext(),
      );

      const builds = await datastore.listAllBuilds();

      // Check that a new build was queued
      assertEquals(builds.length, 1);
      assertEquals(
        builds[0],
        {
          id: builds[0].id,
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
            builds[0].id
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
        repo_id: 274939732,
        owner: "luca-rand",
        repo: "testing",
        description: "Move along, just for testing",
        star_count: 2,
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });

      // Check that no versions.json file was created
      assertEquals(await getMeta("ltest2", "versions.json"), undefined);
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event subdir invalid",
  async fn() {
    try {
      // Send create event
      assertEquals(
        await handler(
          createJSONWebhookEvent(
            "create",
            "/webhook/gh/ltest2",
            createevent,
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
      assertEquals(await datastore.listAllBuilds(), []);

      // Check that there is no module entry in the database
      assertEquals(await database.getModule("ltest2"), null);
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event subdir success",
  async fn() {
    try {
      // Send create event
      const resp = await handler(
        createJSONWebhookEvent(
          "create",
          "/webhook/gh/ltest2",
          createevent,
          { name: "ltest2" },
          { subdir: "asd/" },
        ),
        createContext(),
      );

      const builds = await datastore.listAllBuilds();

      // Check that a new build was queued
      assertEquals(builds.length, 1);
      assertEquals(
        builds[0],
        {
          id: builds[0].id,
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
            builds[0].id
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
        repo_id: 274939732,
        owner: "luca-rand",
        repo: "testing",
        description: "Move along, just for testing",
        star_count: 2,
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });

      // Check that no versions.json file was created
      assertEquals(await getMeta("ltest2", "versions.json"), undefined);
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event subdir success leading slash",
  async fn() {
    try {
      // Send create event
      const resp = await handler(
        createJSONWebhookEvent(
          "create",
          "/webhook/gh/ltest2",
          createevent,
          { name: "ltest2" },
          { subdir: "/asd/" },
        ),
        createContext(),
      );

      const builds = await datastore.listAllBuilds();

      // Check that a new build was queued
      assertEquals(builds.length, 1);
      assertEquals(
        builds[0],
        {
          id: builds[0].id,
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
            builds[0].id
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
        repo_id: 274939732,
        owner: "luca-rand",
        repo: "testing",
        description: "Move along, just for testing",
        star_count: 2,
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });

      // Check that no versions.json file was created
      assertEquals(await getMeta("ltest2", "versions.json"), undefined);
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event subdir success non normalized",
  async fn() {
    try {
      // Send create event
      const resp = await handler(
        createJSONWebhookEvent(
          "create",
          "/webhook/gh/ltest2",
          createevent,
          { name: "ltest2" },
          { subdir: "../../asd/../foo/" },
        ),
        createContext(),
      );

      const builds = await datastore.listAllBuilds();

      // Check that a new build was queued
      assertEquals(builds.length, 1);
      assertEquals(
        builds[0],
        {
          id: builds[0].id,
          created_at: builds[0].created_at,
          options: {
            moduleName: "ltest2",
            type: "github",
            repository: "luca-rand/testing",
            ref: "0.0.7",
            version: "0.0.7",
            subdir: "foo/",
          },
          status: "queued",
        },
      );

      assertEquals(resp, {
        body:
          `{"success":true,"data":{"module":"ltest2","version":"0.0.7","repository":"luca-rand/testing","status_url":"https://deno.land/status/${
            builds[0].id
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
        repo_id: 274939732,
        owner: "luca-rand",
        repo: "testing",
        description: "Move along, just for testing",
        star_count: 2,
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });

      // Check that no versions.json file was created
      assertEquals(await getMeta("ltest2", "versions.json"), undefined);
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event already exists",
  async fn() {
    try {
      await uploadMetaJson(
        "ltest2",
        "versions.json",
        { latest: "0.0.7", versions: ["0.0.7"] },
      );

      // Send create event
      const resp = await handler(
        createJSONWebhookEvent(
          "create",
          "/webhook/gh/ltest2",
          createevent,
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
        repo_id: 274939732,
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
      assertEquals(await datastore.listAllBuilds(), []);
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event already queued",
  async fn() {
    try {
      await datastore.createBuild({
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
          "create",
          "/webhook/gh/ltest2",
          createevent,
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
      const ltest2 = await database.getModule("ltest2");
      assert(ltest2);
      assert(ltest2.created_at <= new Date());
      ltest2.created_at = new Date(2020, 1, 1);

      // Check that the database entry
      assertEquals(ltest2, {
        name: "ltest2",
        type: "github",
        repo_id: 274939732,
        owner: "luca-rand",
        repo: "testing",
        description: "Move along, just for testing",
        star_count: 2,
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event previously failed",
  async fn() {
    try {
      await datastore.createBuild({
        options: {
          moduleName: "ltest2",
          ref: "0.0.7",
          repository: "luca-rand/testing",
          type: "github",
          version: "0.0.7",
        },
        status: "error",
      });

      // Send push event
      const resp = await handler(
        createJSONWebhookEvent(
          "create",
          "/webhook/gh/ltest2",
          createevent,
          { name: "ltest2" },
          {},
        ),
        createContext(),
      );

      const builds = await datastore.listAllBuilds();

      // Check that a new build was queued in addition to the errored build
      assertEquals(builds.length, 2);
      assertEquals(
        builds[0],
        {
          id: builds[0].id,
          created_at: builds[0].created_at,
          options: {
            moduleName: "ltest2",
            type: "github",
            repository: "luca-rand/testing",
            ref: "0.0.7",
            version: "0.0.7",
          },
          status: "error",
        },
      );
      assertEquals(
        builds[1],
        {
          id: builds[1].id,
          created_at: builds[1].created_at,
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
            builds[1].id
          }"}}`,
        headers: {
          "content-type": "application/json",
        },
        statusCode: 200,
      });

      // Check that the database entry was created
      const ltest2 = await database.getModule("ltest2");
      assert(ltest2);
      assert(ltest2.created_at <= new Date());
      ltest2.created_at = new Date(2020, 1, 1);

      // Check that the database entry
      assertEquals(ltest2, {
        name: "ltest2",
        type: "github",
        repo_id: 274939732,
        owner: "luca-rand",
        repo: "testing",
        description: "Move along, just for testing",
        star_count: 2,
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event rename repository",
  async fn() {
    try {
      const repoId = 274939732;

      await database.saveModule({
        name: "ltest",
        description: "testing things",
        repo_id: repoId,
        owner: "luca-rand",
        repo: "testing-oldname",
        star_count: 4,
        type: "github",
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });

      // Send push event
      const resp = await handler(
        createJSONWebhookEvent(
          "create",
          "/webhook/gh/ltest",
          createevent,
          { name: "ltest" },
          {},
        ),
        createContext(),
      );

      const builds = await datastore.listAllBuilds();

      // Check that a new build was queued
      assertEquals(builds.length, 1);
      assertEquals(
        builds[0],
        {
          id: builds[0].id,
          created_at: builds[0].created_at,
          options: {
            moduleName: "ltest",
            type: "github",
            repository: "luca-rand/testing", // <- new name
            ref: "0.0.7",
            version: "0.0.7",
          },
          status: "queued",
        },
      );

      assertEquals(resp, {
        body:
          `{"success":true,"data":{"module":"ltest","version":"0.0.7","repository":"luca-rand/testing","status_url":"https://deno.land/status/${
            builds[0].id
          }"}}`,
        headers: {
          "content-type": "application/json",
        },
        statusCode: 200,
      });

      const ltest = await database.getModule("ltest");
      assert(ltest);
      assert(ltest.created_at <= new Date());
      ltest.created_at = new Date(2020, 1, 1);

      // Check that the database entry
      assertEquals(ltest, {
        name: "ltest",
        type: "github",
        repo_id: repoId,
        owner: "luca-rand",
        repo: "testing",
        description: "Move along, just for testing",
        star_count: 2,
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });

      // Check that no versions.json file was created
      assertEquals(await getMeta("ltest", "versions.json"), undefined);
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event rename repository already exists",
  async fn() {
    try {
      await uploadMetaJson(
        "ltest",
        "versions.json",
        { latest: "0.0.7", versions: ["0.0.7"] },
      );

      const repoId = 274939732;

      await database.saveModule({
        name: "ltest",
        description: "testing things",
        repo_id: repoId,
        owner: "luca-rand",
        repo: "testing-oldname",
        star_count: 4,
        type: "github",
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });

      // Send push event
      const resp = await handler(
        createJSONWebhookEvent(
          "create",
          "/webhook/gh/ltest",
          createevent,
          { name: "ltest" },
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

      const ltest = await database.getModule("ltest");
      assert(ltest);
      assert(ltest.created_at <= new Date());
      ltest.created_at = new Date(2020, 1, 1);

      // Check that the database entry
      assertEquals(ltest, {
        name: "ltest",
        type: "github",
        repo_id: repoId,
        owner: "luca-rand",
        repo: "testing",
        description: "Move along, just for testing",
        star_count: 2,
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });

      // Check that versions.json was not changed
      assertEquals(
        JSON.parse(decoder.decode(await getMeta("ltest", "versions.json"))),
        { latest: "0.0.7", versions: ["0.0.7"] },
      );

      // Check that no new build was queued
      assertEquals(await datastore.listAllBuilds(), []);
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "create event rename repository already queued",
  async fn() {
    try {
      await datastore.createBuild({
        options: {
          moduleName: "ltest",
          ref: "0.0.7",
          repository: "luca-rand/testing",
          type: "github",
          version: "0.0.7",
        },
        status: "queued",
      });

      const repoId = 274939732;

      await database.saveModule({
        name: "ltest",
        description: "testing things",
        repo_id: repoId,
        owner: "luca-rand",
        repo: "testing-oldname",
        star_count: 4,
        type: "github",
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });

      // Send push event
      const resp = await handler(
        createJSONWebhookEvent(
          "create",
          "/webhook/gh/ltest",
          createevent,
          { name: "ltest" },
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
      const ltest = await database.getModule("ltest");
      assert(ltest);
      assert(ltest.created_at <= new Date());
      ltest.created_at = new Date(2020, 1, 1);

      // Check that the database entry
      assertEquals(ltest, {
        name: "ltest",
        type: "github",
        repo_id: repoId,
        owner: "luca-rand",
        repo: "testing",
        description: "Move along, just for testing",
        star_count: 2,
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "push event at max registered to repository",
  async fn() {
    try {
      await database.saveModule({
        name: "ltest2",
        type: "github",
        repo_id: 274939732,
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
        repo_id: 274939732,
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
        repo_id: 274939732,
        owner: "luca-rand",
        repo: "testing",
        description: "",
        star_count: 4,
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });

      const res = await handler(
        createJSONWebhookEvent(
          "create",
          "/webhook/gh/lest4",
          createevent,
          { name: "ltest4" },
          {},
        ),
        createContext(),
      );

      const builds = await datastore.listAllBuilds();

      // Check that a new build was queued
      assertEquals(builds.length, 1);
      assertEquals(
        builds[0],
        {
          id: builds[0].id,
          created_at: builds[0].created_at,
          options: {
            moduleName: "ltest4",
            type: "github",
            repository: "luca-rand/testing",
            ref: "0.0.7",
            version: "0.0.7",
          },
          status: "queued",
        },
      );

      // Send push event for ltest5
      assertEquals(
        res,
        {
          body:
            `{"success":true,"data":{"module":"ltest4","version":"0.0.7","repository":"luca-rand/testing","status_url":"https://deno.land/status/${
              builds[0].id
            }"}}`,
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
  name: "push event grandfathered forbidden name",
  async fn() {
    try {
      // grandfathered module with a forbidden name
      await database.saveModule({
        name: "frisbee",
        description: "Move along, just for frisbee",
        repo_id: 274939733,
        owner: "luca-rand",
        repo: "frisbee",
        star_count: 4,
        type: "github",
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });

      // Send push event
      const resp = await handler(
        createJSONWebhookEvent(
          "create",
          "/webhook/gh/frisbee",
          createeventforbidden,
          { name: "frisbee" },
          {},
        ),
        createContext(),
      );

      const builds = await datastore.listAllBuilds();

      // Check that a new build was queued
      assertEquals(builds.length, 1);
      assertEquals(
        builds[0],
        {
          id: builds[0].id,
          created_at: builds[0].created_at,
          options: {
            moduleName: "frisbee",
            type: "github",
            repository: "luca-rand/frisbee",
            ref: "0.0.7",
            version: "0.0.7",
          },
          status: "queued",
        },
      );

      assertEquals(resp, {
        body:
          `{"success":true,"data":{"module":"frisbee","version":"0.0.7","repository":"luca-rand/frisbee","status_url":"https://deno.land/status/${
            builds[0].id
          }"}}`,
        headers: {
          "content-type": "application/json",
        },
        statusCode: 200,
      });
    } finally {
      await cleanupDatabase(database, datastore);
      await s3.empty();
    }
  },
});
