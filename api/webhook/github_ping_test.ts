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
import { getMeta, s3 } from "../../utils/storage.ts";
const database = await Database.connect(Deno.env.get("MONGO_URI")!);

const decoder = new TextDecoder();

const pingevent = JSON.parse(
  await Deno.readTextFile("./api/webhook/testdata/pingevent.json"),
);
const pingeventforbiddent = JSON.parse(
  await Deno.readTextFile(
    "./api/webhook/testdata/pingeventforbidden.json",
  ),
);
const urlendodedpingevent = await Deno.readTextFile(
  "./api/webhook/testdata/pingevent.txt",
);

Deno.test({
  name: "ping event no name",
  async fn() {
    try {
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
      assertEquals(await database._builds.find({}).toArray(), []);

      // Check that there is no module entry in the database
      assertEquals(await database.getModule("ltest-2"), null);
    } finally {
      await cleanupDatabase(database);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "ping event bad name",
  async fn() {
    try {
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
      assertEquals(await database._builds.find({}).toArray(), []);

      // Check that there is no module entry in the database
      assertEquals(await database.getModule("ltest-2"), null);
    } finally {
      await cleanupDatabase(database);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "ping event forbidden name",
  async fn() {
    try {
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
      assertEquals(await database._builds.find({}).toArray(), []);

      // Check that there is no module entry in the database
      assertEquals(await database.getModule("frisbee"), null);
    } finally {
      await cleanupDatabase(database);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "ping event success",
  async fn() {
    try {
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

      // Check that a versions.json file was created
      assertEquals(
        JSON.parse(decoder.decode(await getMeta("ltest2", "versions.json"))),
        { latest: null, versions: [] },
      );

      // Check that no new build was queued
      assertEquals(await database._builds.find({}).toArray(), []);
    } finally {
      await cleanupDatabase(database);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "ping event success - web form",
  async fn() {
    try {
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

      // Check that a versions.json file was created
      assertEquals(
        JSON.parse(decoder.decode(await getMeta("ltest2", "versions.json"))),
        { latest: null, versions: [] },
      );

      // Check that no new build was queued
      assertEquals(await database._builds.find({}).toArray(), []);
    } finally {
      await cleanupDatabase(database);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "ping event max registered to repository",
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
      assertEquals(await database._builds.find({}).toArray(), []);
    } finally {
      await cleanupDatabase(database);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "ping event rename repository",
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
          '{"success":true,"data":{"module":"ltest","repository":"luca-rand/testing"}}',
        headers: {
          "content-type": "application/json",
        },
        statusCode: 200,
      });

      const ltest2 = await database.getModule("ltest");
      assert(ltest2);
      assertEquals(ltest2.repo_id, repoId);
    } finally {
      await cleanupDatabase(database);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "ping event wrong repository",
  async fn() {
    try {
      const repoId = 123456789;

      await database.saveModule({
        name: "ltest",
        description: "testing things",
        repo_id: repoId,
        owner: "luca-rand",
        repo: "testing2",
        star_count: 4,
        type: "github",
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
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
      assertEquals(await database._builds.find({}).toArray(), []);

      const ltest = await database.getModule("ltest");
      assert(ltest);
      assert(ltest.created_at <= new Date());
      ltest.created_at = new Date(2020, 1, 1);

      // Check that the database entry did not change
      assertEquals(ltest, {
        name: "ltest",
        description: "testing things",
        repo_id: repoId,
        owner: "luca-rand",
        repo: "testing2",
        star_count: 4,
        type: "github",
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
      });
    } finally {
      await cleanupDatabase(database);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "ping event success capitalization",
  async fn() {
    try {
      database.saveModule({
        name: "ltest2",
        description: "testing things",
        repo_id: 274939732,
        owner: "lUca-rand",
        repo: "Testing",
        star_count: 4,
        type: "github",
        is_unlisted: false,
        created_at: new Date(2020, 1, 1),
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

      // Check that a versions.json file was created
      assertEquals(
        JSON.parse(decoder.decode(await getMeta("ltest2", "versions.json"))),
        { latest: null, versions: [] },
      );

      // Check that no new build was queued
      assertEquals(await database._builds.find({}).toArray(), []);
    } finally {
      await cleanupDatabase(database);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "ping event blocked owner",
  async fn() {
    try {
      database.saveOwnerQuota({
        type: "github",
        owner: "luca-rand",
        max_modules: 0,
        blocked: true,
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
          '{"success":false,"error":"Publishing your module failed. Please contact modules@deno.com."}',
        headers: {
          "content-type": "application/json",
        },
        statusCode: 400,
      });

      // Check that no versions.json file exists
      assertEquals(await getMeta("ltest2", "versions.json"), undefined);

      // Check that no builds are queued
      assertEquals(await database._builds.find({}).toArray(), []);

      // Check that there is no module entry in the database
      assertEquals(await database.getModule("ltest2"), null);
    } finally {
      await cleanupDatabase(database);
      await s3.empty();
    }
  },
});

Deno.test({
  name: "ping event blocked sender",
  async fn() {
    try {
      database.saveOwnerQuota({
        type: "github",
        owner: "lucacasonato",
        max_modules: 0,
        blocked: true,
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
          '{"success":false,"error":"Publishing your module failed. Please contact modules@deno.com."}',
        headers: {
          "content-type": "application/json",
        },
        statusCode: 400,
      });

      // Check that no versions.json file exists
      assertEquals(await getMeta("ltest2", "versions.json"), undefined);

      // Check that no builds are queued
      assertEquals(await database._builds.find({}).toArray(), []);

      // Check that there is no module entry in the database
      assertEquals(await database.getModule("ltest2"), null);
    } finally {
      await cleanupDatabase(database);
      await s3.empty();
    }
  },
});
