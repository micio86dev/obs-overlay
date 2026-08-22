import assert from "node:assert/strict";
import test from "node:test";
import { createMockEvent, isOverlayEvent } from "../src/index.ts";

test("mock events satisfy the shared overlay event contract", () => {
  const event = createMockEvent("chat", 1);

  assert.equal(isOverlayEvent(event), true);
  assert.equal(event.type, "chat");
  assert.equal(event.id, "mock-chat-1");
});

test("runtime validation rejects payloads missing discriminated fields", () => {
  assert.equal(isOverlayEvent({ id: "1", type: "chat", occurredAt: "2026-01-01T00:00:00.000Z", author: "viewer" }), false);
  assert.equal(isOverlayEvent({ id: "2", type: "superchat", occurredAt: "2026-01-01T00:00:00.000Z", author: "viewer", amount: "€5" }), false);
  assert.equal(isOverlayEvent({ id: "3", type: "subscriber", occurredAt: "invalid", author: "viewer", message: 42 }), false);
});

test("chat events accept an optional stable author identity and reject invalid identities", () => {
  assert.equal(isOverlayEvent({ id: "4", type: "chat", occurredAt: "2026-01-01T00:00:00.000Z", author: "viewer", authorId: "channel-1", message: "1" }), true);
  assert.equal(isOverlayEvent({ id: "5", type: "chat", occurredAt: "2026-01-01T00:00:00.000Z", author: "viewer", authorId: 42, message: "1" }), false);
});
