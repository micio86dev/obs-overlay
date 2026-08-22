import assert from "node:assert/strict";
import test from "node:test";
import { MockSource } from "../src/sources/mock-source.ts";
import { clampPollInterval, YouTubeSource } from "../src/sources/youtube-source.ts";

test("MockSource emits normalized rotating stream events", () => {
  const source = new MockSource(60_000);
  const received: string[] = [];
  source.subscribe((event) => received.push(event.type));

  source.emitNext();
  source.emitNext();
  source.emitNext();

  assert.deepEqual(received, ["chat", "subscriber", "superchat"]);
  source.stop();
});

test("MockSource start and stop are idempotent", () => {
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let schedules = 0;
  globalThis.setInterval = ((handler: TimerHandler) => { void handler; schedules += 1; return 1 as unknown as ReturnType<typeof setInterval>; }) as typeof setInterval;
  globalThis.clearInterval = (() => undefined) as typeof clearInterval;

  try {
    const source = new MockSource();
    source.start();
    source.start();
    source.stop();
    source.stop();
    assert.equal(schedules, 1);
  } finally {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});

test("YouTubeSource does not reschedule an in-flight poll after stop", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  let resolveFetch: ((value: Response) => void) | undefined;
  let schedules = 0;
  globalThis.fetch = (() => new Promise<Response>((resolve) => { resolveFetch = resolve; })) as typeof fetch;
  globalThis.setTimeout = ((handler: TimerHandler, delay?: number) => { void handler; schedules += 1; assert.equal(delay, 10_000); return 1 as unknown as ReturnType<typeof setTimeout>; }) as typeof setTimeout;

  try {
    const source = new YouTubeSource("key", "chat", Number.NaN);
    source.start();
    source.stop();
    resolveFetch?.(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    await new Promise<void>((resolve) => originalSetTimeout(resolve, 0));
    assert.equal(schedules, 0);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});


test("YouTubeSource clamps invalid polling intervals to a quota-safe range", () => {
  assert.equal(clampPollInterval(Number.NaN), 10_000);
  assert.equal(clampPollInterval(1), 1_000);
  assert.equal(clampPollInterval(120_000), 60_000);
});

test("YouTubeSource start is idempotent", () => {
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = (() => {
    fetches += 1;
    return new Promise<Response>(() => undefined);
  }) as typeof fetch;

  try {
    const source = new YouTubeSource("key", "chat");
    source.start();
    source.start();
    source.stop();
    assert.equal(fetches, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
