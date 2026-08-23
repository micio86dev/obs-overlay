import assert from "node:assert/strict";
import test from "node:test";
import { QuotaBudget, quotaUnits } from "../src/quota-budget.ts";

const day = 24 * 60 * 60 * 1_000;
const noon = Date.parse("2026-08-23T12:00:00.000Z");

test("documents the official unit cost of every endpoint the relay calls", () => {
  assert.deepEqual(quotaUnits, { liveChatMessages: 5, search: 100, channels: 1, videos: 1 });
});

test("stays normal below the degrade threshold and degrades at eighty percent", () => {
  const budget = new QuotaBudget(1_000, () => noon);

  budget.spend(700);
  assert.equal(budget.pressure, "normal");
  budget.spend(100);
  assert.equal(budget.pressure, "degraded");
  assert.equal(budget.spent, 800);
});

test("halts once the daily allowance is exhausted", () => {
  const budget = new QuotaBudget(1_000, () => noon);

  budget.spend(1_000);
  assert.equal(budget.pressure, "exhausted");
  assert.equal(budget.canSpend(quotaUnits.liveChatMessages), false);
});

test("resets on the next UTC midnight and reports the delay until it", () => {
  let now = noon;
  const budget = new QuotaBudget(1_000, () => now);

  budget.spend(1_000);
  assert.equal(budget.millisecondsUntilReset(), 12 * 60 * 60 * 1_000);

  now = Date.parse("2026-08-24T00:00:00.000Z");
  assert.equal(budget.pressure, "normal");
  assert.equal(budget.spent, 0);
  assert.equal(budget.canSpend(quotaUnits.search), true);
});

test("a multi-day gap resets exactly once rather than accumulating", () => {
  let now = noon;
  const budget = new QuotaBudget(1_000, () => now);

  budget.spend(900);
  now = noon + 5 * day;
  assert.equal(budget.spent, 0);
  budget.spend(10);
  assert.equal(budget.spent, 10);
});

test("an unbounded budget never applies pressure", () => {
  const budget = new QuotaBudget(0, () => noon);

  budget.spend(1_000_000);
  assert.equal(budget.pressure, "normal");
  assert.equal(budget.canSpend(quotaUnits.search), true);
});
