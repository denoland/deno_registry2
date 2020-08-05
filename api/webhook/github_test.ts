import { handler } from "./github.ts";
import {
  createJSONWebhookEvent,
  createContext,
} from "../../utils/test_utils.ts";
import { Database } from "../../utils/database.ts";
import { assertEquals } from "../../test_deps.ts";
import { getMeta } from "../../utils/storage.ts";

const database = new Database(Deno.env.get("MONGO_URI")!);

const decoder = new TextDecoder();

const pingevent = {
  "zen": "Approachable is better than simple.",
  "hook_id": 239297153,
  "hook": {
    "type": "Repository",
    "id": 239297153,
    "name": "web",
    "active": true,
    "events": [
      "create",
      "push",
    ],
    "config": {
      "content_type": "json",
      "insecure_ssl": "0",
      "url": "https://api.deno.land/webhook/gh/ltest2",
    },
    "updated_at": "2020-08-05T15:15:39Z",
    "created_at": "2020-08-05T15:15:39Z",
    "url": "https://api.github.com/repos/luca-rand/testing/hooks/239297153",
    "test_url":
      "https://api.github.com/repos/luca-rand/testing/hooks/239297153/test",
    "ping_url":
      "https://api.github.com/repos/luca-rand/testing/hooks/239297153/pings",
    "last_response": {
      "code": null,
      "status": "unused",
      "message": null,
    },
  },
  "repository": {
    "id": 274939732,
    "node_id": "MDEwOlJlcG9zaXRvcnkyNzQ5Mzk3MzI=",
    "name": "testing",
    "full_name": "luca-rand/testing",
    "private": false,
    "owner": {
      "login": "luca-rand",
      "id": 52681900,
      "node_id": "MDEyOk9yZ2FuaXphdGlvbjUyNjgxOTAw",
      "avatar_url": "https://avatars3.githubusercontent.com/u/52681900?v=4",
      "gravatar_id": "",
      "url": "https://api.github.com/users/luca-rand",
      "html_url": "https://github.com/luca-rand",
      "followers_url": "https://api.github.com/users/luca-rand/followers",
      "following_url":
        "https://api.github.com/users/luca-rand/following{/other_user}",
      "gists_url": "https://api.github.com/users/luca-rand/gists{/gist_id}",
      "starred_url":
        "https://api.github.com/users/luca-rand/starred{/owner}{/repo}",
      "subscriptions_url":
        "https://api.github.com/users/luca-rand/subscriptions",
      "organizations_url": "https://api.github.com/users/luca-rand/orgs",
      "repos_url": "https://api.github.com/users/luca-rand/repos",
      "events_url": "https://api.github.com/users/luca-rand/events{/privacy}",
      "received_events_url":
        "https://api.github.com/users/luca-rand/received_events",
      "type": "Organization",
      "site_admin": false,
    },
    "html_url": "https://github.com/luca-rand/testing",
    "description": "Move along, just for testing",
    "fork": false,
    "url": "https://api.github.com/repos/luca-rand/testing",
    "forks_url": "https://api.github.com/repos/luca-rand/testing/forks",
    "keys_url": "https://api.github.com/repos/luca-rand/testing/keys{/key_id}",
    "collaborators_url":
      "https://api.github.com/repos/luca-rand/testing/collaborators{/collaborator}",
    "teams_url": "https://api.github.com/repos/luca-rand/testing/teams",
    "hooks_url": "https://api.github.com/repos/luca-rand/testing/hooks",
    "issue_events_url":
      "https://api.github.com/repos/luca-rand/testing/issues/events{/number}",
    "events_url": "https://api.github.com/repos/luca-rand/testing/events",
    "assignees_url":
      "https://api.github.com/repos/luca-rand/testing/assignees{/user}",
    "branches_url":
      "https://api.github.com/repos/luca-rand/testing/branches{/branch}",
    "tags_url": "https://api.github.com/repos/luca-rand/testing/tags",
    "blobs_url":
      "https://api.github.com/repos/luca-rand/testing/git/blobs{/sha}",
    "git_tags_url":
      "https://api.github.com/repos/luca-rand/testing/git/tags{/sha}",
    "git_refs_url":
      "https://api.github.com/repos/luca-rand/testing/git/refs{/sha}",
    "trees_url":
      "https://api.github.com/repos/luca-rand/testing/git/trees{/sha}",
    "statuses_url":
      "https://api.github.com/repos/luca-rand/testing/statuses/{sha}",
    "languages_url": "https://api.github.com/repos/luca-rand/testing/languages",
    "stargazers_url":
      "https://api.github.com/repos/luca-rand/testing/stargazers",
    "contributors_url":
      "https://api.github.com/repos/luca-rand/testing/contributors",
    "subscribers_url":
      "https://api.github.com/repos/luca-rand/testing/subscribers",
    "subscription_url":
      "https://api.github.com/repos/luca-rand/testing/subscription",
    "commits_url":
      "https://api.github.com/repos/luca-rand/testing/commits{/sha}",
    "git_commits_url":
      "https://api.github.com/repos/luca-rand/testing/git/commits{/sha}",
    "comments_url":
      "https://api.github.com/repos/luca-rand/testing/comments{/number}",
    "issue_comment_url":
      "https://api.github.com/repos/luca-rand/testing/issues/comments{/number}",
    "contents_url":
      "https://api.github.com/repos/luca-rand/testing/contents/{+path}",
    "compare_url":
      "https://api.github.com/repos/luca-rand/testing/compare/{base}...{head}",
    "merges_url": "https://api.github.com/repos/luca-rand/testing/merges",
    "archive_url":
      "https://api.github.com/repos/luca-rand/testing/{archive_format}{/ref}",
    "downloads_url": "https://api.github.com/repos/luca-rand/testing/downloads",
    "issues_url":
      "https://api.github.com/repos/luca-rand/testing/issues{/number}",
    "pulls_url":
      "https://api.github.com/repos/luca-rand/testing/pulls{/number}",
    "milestones_url":
      "https://api.github.com/repos/luca-rand/testing/milestones{/number}",
    "notifications_url":
      "https://api.github.com/repos/luca-rand/testing/notifications{?since,all,participating}",
    "labels_url":
      "https://api.github.com/repos/luca-rand/testing/labels{/name}",
    "releases_url":
      "https://api.github.com/repos/luca-rand/testing/releases{/id}",
    "deployments_url":
      "https://api.github.com/repos/luca-rand/testing/deployments",
    "created_at": "2020-06-25T14:37:46Z",
    "updated_at": "2020-07-27T12:39:23Z",
    "pushed_at": "2020-07-28T15:00:40Z",
    "git_url": "git://github.com/luca-rand/testing.git",
    "ssh_url": "git@github.com:luca-rand/testing.git",
    "clone_url": "https://github.com/luca-rand/testing.git",
    "svn_url": "https://github.com/luca-rand/testing",
    "homepage": null,
    "size": 5,
    "stargazers_count": 2,
    "watchers_count": 2,
    "language": "TypeScript",
    "has_issues": true,
    "has_projects": true,
    "has_downloads": true,
    "has_wiki": true,
    "has_pages": false,
    "forks_count": 0,
    "mirror_url": null,
    "archived": false,
    "disabled": false,
    "open_issues_count": 1,
    "license": {
      "key": "mit",
      "name": "MIT License",
      "spdx_id": "MIT",
      "url": "https://api.github.com/licenses/mit",
      "node_id": "MDc6TGljZW5zZTEz",
    },
    "forks": 0,
    "open_issues": 1,
    "watchers": 2,
    "default_branch": "master",
  },
  "sender": {
    "login": "lucacasonato",
    "id": 7829205,
    "node_id": "MDQ6VXNlcjc4MjkyMDU=",
    "avatar_url": "https://avatars0.githubusercontent.com/u/7829205?v=4",
    "gravatar_id": "",
    "url": "https://api.github.com/users/lucacasonato",
    "html_url": "https://github.com/lucacasonato",
    "followers_url": "https://api.github.com/users/lucacasonato/followers",
    "following_url":
      "https://api.github.com/users/lucacasonato/following{/other_user}",
    "gists_url": "https://api.github.com/users/lucacasonato/gists{/gist_id}",
    "starred_url":
      "https://api.github.com/users/lucacasonato/starred{/owner}{/repo}",
    "subscriptions_url":
      "https://api.github.com/users/lucacasonato/subscriptions",
    "organizations_url": "https://api.github.com/users/lucacasonato/orgs",
    "repos_url": "https://api.github.com/users/lucacasonato/repos",
    "events_url": "https://api.github.com/users/lucacasonato/events{/privacy}",
    "received_events_url":
      "https://api.github.com/users/lucacasonato/received_events",
    "type": "User",
    "site_admin": false,
  },
};

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
