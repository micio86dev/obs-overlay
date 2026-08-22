import assert from "node:assert/strict";
import test from "node:test";
import { createMockEvent, isOverlayEvent } from "../src/index.ts";

test("mock events satisfy the shared overlay event contract", () => {
  const event = createMockEvent("chat", 1);

  assert.equal(isOverlayEvent(event), true);
  assert.equal(event.type, "chat");
  assert.equal(event.id, "mock-chat-1");
});
