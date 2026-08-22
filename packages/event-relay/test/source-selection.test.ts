import assert from "node:assert/strict";
import test from "node:test";
import { createEventSource, IdleSource } from "../src/source-selection.ts";
import { MockSource } from "../src/sources/mock-source.ts";

test("createEventSource defaults to a healthy idle relay that emits no fabricated events", () => {
  const source = createEventSource({ mockIntervalMs: 8_000, pollIntervalMs: 10_000 });
  assert.ok(source instanceof IdleSource);
});

test("createEventSource requires an explicit opt-in before enabling synthetic mock events", () => {
  assert.throws(
    () => createEventSource({ sourceName: "mock", mockIntervalMs: 8_000, pollIntervalMs: 10_000 }),
    /MOCK_SOURCE_ENABLED=true/,
  );
  assert.ok(createEventSource({
    sourceName: "mock",
    mockSourceEnabled: "true",
    mockIntervalMs: 8_000,
    pollIntervalMs: 10_000,
  }) instanceof MockSource);
});

test("createEventSource keeps explicit YouTube selection available", () => {
  const source = createEventSource({
    sourceName: "youtube",
    youtubeApiKey: "api-key",
    youtubeChannelHandle: "@miciodev",
    mockIntervalMs: 8_000,
    pollIntervalMs: 10_000,
  });
  assert.equal(source.constructor.name, "YouTubeSource");
});
