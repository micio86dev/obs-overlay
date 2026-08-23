import assert from "node:assert/strict";
import test from "node:test";
import { QuotaBudget, quotaUnits } from "../src/quota-budget.ts";
import { YouTubeSource } from "../src/sources/youtube-source.ts";

interface FakeTimer { handler: TimerHandler; delay: number; cleared: boolean }

/** Runs one poll against a stubbed API and returns the timers the source scheduled. */
async function pollOnce(source: YouTubeSource, body: Record<string, unknown>): Promise<FakeTimer[]> {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers: FakeTimer[] = [];
  globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))) as typeof fetch;
  globalThis.setTimeout = ((handler: TimerHandler, delay = 0) => { timers.push({ handler, delay, cleared: false }); return timers.length as unknown as ReturnType<typeof setTimeout>; }) as typeof setTimeout;
  globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => { const timer = timers[Number(id) - 1]; if (timer) timer.cleared = true; }) as typeof clearTimeout;
  try {
    source.start();
    await new Promise<void>((resolve) => originalSetTimeout(resolve, 0));
    // Snapshot before stop(), which cancels the very timers under test.
    return timers.map((timer) => ({ ...timer }));
  } finally {
    source.stop();
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
}

test("the chat loop never polls faster than the configured floor even when YouTube asks it to", async () => {
  const source = new YouTubeSource("key", "chat", 10_000);
  const timers = await pollOnce(source, { items: [], pollingIntervalMillis: 1_000 });

  assert.ok(timers.some((timer) => timer.delay === 10_000 && !timer.cleared));
  assert.equal(timers.some((timer) => timer.delay === 1_000), false);
});

test("a chat poll charges its documented quota cost", async () => {
  const budget = new QuotaBudget(10_000);
  const source = new YouTubeSource("key", "chat", 10_000, undefined, undefined, budget);
  await pollOnce(source, { items: [] });

  assert.equal(budget.spent, quotaUnits.liveChatMessages);
});

test("a degraded budget slows chat polling instead of failing", async () => {
  const budget = new QuotaBudget(1_000);
  budget.spend(800);
  const source = new YouTubeSource("key", "chat", 10_000, undefined, undefined, budget);
  const timers = await pollOnce(source, { items: [] });

  assert.ok(timers.some((timer) => timer.delay === 60_000 && !timer.cleared));
});

test("an exhausted budget parks the chat loop until the quota resets", async () => {
  const budget = new QuotaBudget(10);
  budget.spend(10);
  const source = new YouTubeSource("key", "chat", 10_000, undefined, undefined, budget);
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    const timers = await pollOnce(source, { items: [] });
    const parked = timers.find((timer) => timer.delay > 60_000 && !timer.cleared);

    assert.ok(parked, "expected the loop to be parked until the reset");
    assert.ok(Math.abs(parked.delay - budget.millisecondsUntilReset()) < 5_000);
    assert.equal(budget.spent, 10, "an exhausted budget must not issue the request");
  } finally {
    console.warn = originalWarn;
  }
});
