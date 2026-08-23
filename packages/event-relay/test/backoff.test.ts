import assert from "node:assert/strict";
import test from "node:test";
import { Backoff } from "../src/backoff.ts";
import { RecentIds } from "../src/recent-ids.ts";

test("Backoff doubles each attempt and stops at its ceiling", () => {
  const backoff = new Backoff(10_000, 40_000);

  assert.deepEqual([backoff.next(), backoff.next(), backoff.next(), backoff.next()], [10_000, 20_000, 40_000, 40_000]);
  backoff.reset();
  assert.equal(backoff.next(), 10_000);
});

test("Backoff rejects bounds that would busy-loop", () => {
  assert.throws(() => new Backoff(0, 1_000), /Invalid backoff bounds/);
  assert.throws(() => new Backoff(2_000, 1_000), /Invalid backoff bounds/);
});

test("RecentIds evicts the oldest entry once full", () => {
  const seen = new RecentIds(2);
  seen.add("a");
  seen.add("b");
  seen.add("c");

  assert.equal(seen.has("a"), false);
  assert.equal(seen.has("b"), true);
  assert.equal(seen.has("c"), true);
});
