// Copyright 2020-2021 the Deno authors. All rights reserved. MIT license.

import { assert, assertEquals, assertThrows } from "../test_deps.ts";
import { ip4ToInt, isIp4InCidr } from "./net.ts";

Deno.test({
  name: "ipv4 parsing",
  fn() {
    assert(ip4ToInt("1.1.1.1"));
    assertThrows(() => ip4ToInt("1.1.1.1.1"));
    assertThrows(() => ip4ToInt("1.1.1.-1"));
    assertThrows(() => ip4ToInt("1.1.1.300"));
  },
});

Deno.test({
  name: "ipv4 in cidr matches",
  fn() {
    assertEquals(isIp4InCidr("1.1.1.1")("0.0.0.0/0"), true);
    assertEquals(isIp4InCidr("1.1.1.1")("1.1.1.0/24"), true);
    assertEquals(isIp4InCidr("1.1.1.1")("1.1.1.0/31"), true);
    assertEquals(isIp4InCidr("1.1.1.1")("1.1.1.0/32"), false);
    assertEquals(isIp4InCidr("1.1.1.1")("1.2.1.0/31"), false);
  },
});
