import assert from "node:assert/strict";
import test from "node:test";
import { MockSource } from "../src/sources/mock-source.ts";

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
