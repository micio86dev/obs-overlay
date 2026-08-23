import assert from "node:assert/strict";
import test from "node:test";
import { QuotaBudget, quotaUnits } from "../src/quota-budget.ts";
import { ChannelStatisticsPoller } from "../src/sources/channel-statistics.ts";

interface FakeTimer { handler: TimerHandler; delay: number; cleared: boolean }

/** Runs one refresh against a stubbed API and returns the timers the poller scheduled. */
async function refreshOnce(poller: ChannelStatisticsPoller, body: Record<string, unknown>): Promise<FakeTimer[]> {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers: FakeTimer[] = [];
  globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))) as typeof fetch;
  // The poller schedules its very first refresh with delay 0; fire that one immediately so the
  // stubbed fetch actually runs, while later (real) delays are only recorded, not executed.
  globalThis.setTimeout = ((handler: TimerHandler, delay = 0) => {
    timers.push({ handler, delay, cleared: false });
    if (delay === 0 && typeof handler === "function") handler();
    return timers.length as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => { const timer = timers[Number(id) - 1]; if (timer) timer.cleared = true; }) as typeof clearTimeout;
  try {
    poller.start();
    await new Promise<void>((resolve) => originalSetTimeout(resolve, 0));
    return timers.map((timer) => ({ ...timer }));
  } finally {
    poller.stop();
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
}

test("reports the subscriber count it fetched and schedules the next refresh", async () => {
  const reported: (number | undefined)[] = [];
  const poller = new ChannelStatisticsPoller({
    apiKey: "key",
    channelHandle: "@MicioDev",
    budget: new QuotaBudget(0),
    reportPressure: () => "normal",
    onSubscriberCount: (count) => reported.push(count),
  });

  const timers = await refreshOnce(poller, { items: [{ statistics: { subscriberCount: "1200" } }] });

  assert.deepEqual(reported, [1_200]);
  assert.ok(timers.some((timer) => timer.delay === 5 * 60_000 && !timer.cleared));
});

test("charges its documented quota cost", async () => {
  const budget = new QuotaBudget(10_000);
  const poller = new ChannelStatisticsPoller({
    apiKey: "key",
    channelHandle: "@MicioDev",
    budget,
    reportPressure: () => budget.pressure,
    onSubscriberCount: () => undefined,
  });

  await refreshOnce(poller, { items: [{ statistics: { subscriberCount: "1200" } }] });

  assert.equal(budget.spent, quotaUnits.channels);
});

test("parks itself until the quota resets rather than spending against an exhausted budget", async () => {
  const budget = new QuotaBudget(10);
  budget.spend(10);
  const poller = new ChannelStatisticsPoller({
    apiKey: "key",
    channelHandle: "@MicioDev",
    budget,
    reportPressure: () => budget.pressure,
    onSubscriberCount: () => undefined,
  });

  const timers = await refreshOnce(poller, { items: [] });
  const parked = timers.find((timer) => timer.delay > 60_000 && !timer.cleared);

  assert.ok(parked, "expected the poller to be parked until the reset");
  assert.equal(budget.spent, 10, "an exhausted budget must not issue the request");
});
