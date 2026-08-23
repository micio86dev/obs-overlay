import assert from "node:assert/strict";
import test from "node:test";
import { createEmptySessionMetrics, type LiveState } from "@miciodev/shared-types";
import { StateBroadcastCoalescer } from "../src/state-broadcast.ts";

function state(overrides: Partial<LiveState> = {}): LiveState {
  return { status: "live", session: createEmptySessionMetrics(), ...overrides };
}

/** Deterministic stand-in for the event loop so coalescing windows are exact. */
function fakeClock() {
  let current = 0;
  const pending = new Map<number, { at: number; run: () => void }>();
  let nextId = 1;
  return {
    now: () => current,
    setTimeout: ((run: () => void, delay = 0) => { pending.set(nextId, { at: current + delay, run }); return nextId++; }) as unknown as typeof setTimeout,
    clearTimeout: ((id: number) => { pending.delete(id); }) as unknown as typeof clearTimeout,
    advance(ms: number) {
      current += ms;
      for (const [id, entry] of [...pending]) {
        if (entry.at <= current) { pending.delete(id); entry.run(); }
      }
    },
  };
}

test("publishes the first state immediately", () => {
  const clock = fakeClock();
  const published: LiveState[] = [];
  const coalescer = new StateBroadcastCoalescer((next) => published.push(next), 1_000, clock);

  coalescer.push(state({ concurrentViewers: 1 }));
  assert.equal(published.length, 1);
});

test("collapses a burst into a single trailing frame per window", () => {
  const clock = fakeClock();
  const published: LiveState[] = [];
  const coalescer = new StateBroadcastCoalescer((next) => published.push(next), 1_000, clock);

  coalescer.push(state({ concurrentViewers: 1 }));
  for (let viewers = 2; viewers <= 50; viewers += 1) coalescer.push(state({ concurrentViewers: viewers }));

  assert.equal(published.length, 1, "the burst must not publish per event");
  clock.advance(1_000);
  assert.equal(published.length, 2);
  assert.equal(published.at(-1)?.concurrentViewers, 50, "the trailing frame carries the latest state");
});

test("a status change flushes immediately instead of waiting for the window", () => {
  const clock = fakeClock();
  const published: LiveState[] = [];
  const coalescer = new StateBroadcastCoalescer((next) => published.push(next), 1_000, clock);

  coalescer.push(state({ status: "live" }));
  coalescer.push(state({ status: "live", concurrentViewers: 9 }));
  assert.equal(published.length, 1);

  coalescer.push(state({ status: "complete" }));
  assert.equal(published.length, 2);
  assert.equal(published.at(-1)?.status, "complete");
});

test("a new broadcast flushes immediately", () => {
  const clock = fakeClock();
  const published: LiveState[] = [];
  const coalescer = new StateBroadcastCoalescer((next) => published.push(next), 1_000, clock);

  coalescer.push(state({ broadcastId: "video-1" }));
  coalescer.push(state({ broadcastId: "video-2" }));
  assert.equal(published.length, 2);
});

test("dispose drops the pending frame so a shutdown leaks no timer", () => {
  const clock = fakeClock();
  const published: LiveState[] = [];
  const coalescer = new StateBroadcastCoalescer((next) => published.push(next), 1_000, clock);

  coalescer.push(state());
  coalescer.push(state({ concurrentViewers: 5 }));
  coalescer.dispose();
  clock.advance(5_000);

  assert.equal(published.length, 1);
});
