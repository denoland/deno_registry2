import { assertEquals } from "../test_deps.ts";
import { isForbidden } from "./moderation.ts";

Deno.test({
  name: "test valid name",
  fn() {
    const badwords = ["foo", "bar", "baz"];
    assertEquals(isForbidden("testing", badwords), false);
  },
});

Deno.test({
  name: "test forbidden name",
  fn() {
    const badwords = ["foo", "bar", "baz"];
    assertEquals(isForbidden("bar", badwords), true);
  },
});

Deno.test({
  name: "test forbidden word combination",
  fn() {
    const badwords = ["frozen_yogurt", "bouncy_castle"];
    assertEquals(isForbidden("frozen_yogurt", badwords), true);
  },
});

Deno.test({
  name: "test forbidden name with other valid words",
  fn() {
    const badwords = ["foo", "bar", "baz", "zen", "frozen_yogurt"];
    assertEquals(isForbidden("lots_of_foo", badwords), true);
    assertEquals(isForbidden("foo_is_great", badwords), true);
    assertEquals(isForbidden("the_zen_of_deno", badwords), true);
    assertEquals(isForbidden("love_frozen_yogurt_a_lot", badwords), true);
  },
});

Deno.test({
  name: "test valid name containing forbidden parts",
  fn() {
    const badwords = ["foo"];
    assertEquals(isForbidden("foosball", badwords), false);
    assertEquals(isForbidden("bigfoot", badwords), false);
  },
});
