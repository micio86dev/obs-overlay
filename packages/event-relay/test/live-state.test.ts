import assert from "node:assert/strict";
import test from "node:test";
import { LiveSessionTracker } from "../src/live-state.ts";

test("tracks peak viewers and resets all session aggregates at a broadcast boundary", () => {
  const tracker = new LiveSessionTracker();
  tracker.update({ status: "live", broadcastId: "one", concurrentViewers: 24 });
  tracker.record({ id: "chat", type: "chat", occurredAt: "2026-08-23T12:00:00.000Z", author: "viewer", message: "Hi" });
  tracker.record({ id: "support", type: "superchat", occurredAt: "2026-08-23T12:00:00.000Z", author: "viewer", amount: "€2", currency: "EUR", amountMicros: 2_000_000, message: "Thanks" });
  assert.equal(tracker.snapshot.peakViewers, 24);
  assert.equal(tracker.snapshot.session.chatMessages, 1);
  assert.equal(tracker.snapshot.session.superChatRevenueMicros.EUR, 2_000_000);

  tracker.update({ status: "live", broadcastId: "two", concurrentViewers: 4 });
  assert.equal(tracker.snapshot.peakViewers, 4);
  assert.equal(tracker.snapshot.session.chatMessages, 0);
  assert.deepEqual(tracker.snapshot.session.superChatRevenueMicros, {});
});

test("clears live-only counters once a chat ending transitions the relay offline", () => {
  const tracker = new LiveSessionTracker();
  tracker.update({ status: "live", broadcastId: "one", concurrentViewers: 24 });
  tracker.record({ id: "chat", type: "chat", occurredAt: "2026-08-23T12:00:00.000Z", author: "viewer", message: "Hi" });
  tracker.update({ status: "offline" });
  assert.equal(tracker.snapshot.session.chatMessages, 0);
  assert.equal(tracker.snapshot.broadcastId, undefined);
});
