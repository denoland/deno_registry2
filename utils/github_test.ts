// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.
import { assert, assertEquals } from "../test_deps.ts";
import { GitHub } from "./github.ts";

const gh = new GitHub();

Deno.test({
  name: "get repository",
  async fn() {
    const owner = "wperron-rand", name = "testing";
    const res = await gh.getRepo(owner, name);
    assertEquals(res.status, 200);
    const repo = await res.json();
    assertEquals(repo.id, 290582991);
    assertEquals(repo.full_name, `${owner}/${name}`);

    const rate = gh.getRateLimits();
    assert(rate.rateLimit !== undefined);
    assert(rate.rateRemaining !== undefined);
    assert(rate.rateLimitReset !== undefined);
    assert((rate.rateLimitReset as Date).getTime() > new Date().getTime());
  },
});
