import assert from "node:assert/strict";
import test from "node:test";
import { ParticipantIdentityMapper } from "../src/participant-identity.js";

test("replaces a provider channel ID with a stable per-process opaque participant ID", () => {
  const mapper = new ParticipantIdentityMapper();
  const event = { id: "message", type: "chat" as const, author: "Viewer", authorId: "UC-private-channel", message: "2", occurredAt: "2026-08-22T00:00:00.000Z" };
  const first = mapper.map(event);
  const second = mapper.map({ ...event, id: "message-2" });

  assert.notEqual(first.authorId, event.authorId);
  assert.match(first.authorId ?? "", /^participant-[0-9a-f-]{36}$/);
  assert.equal(second.authorId, first.authorId);
  assert.notEqual(first.id, event.id);
  assert.notEqual(first.author, event.author);
  assert.equal(first.avatarUrl, undefined);
});

test("maps every event kind and bounds retained provider identities", () => {
  const mapper = new ParticipantIdentityMapper(1);
  const subscriber = mapper.map({ id: "subscriber", type: "subscriber", author: "Member", authorId: "UC-member", occurredAt: "2026-08-22T00:00:00.000Z" });
  const superchat = mapper.map({ id: "super", type: "superchat", author: "Supporter", authorId: "UC-supporter", amount: "€5", currency: "EUR", message: "Hi", occurredAt: "2026-08-22T00:00:00.000Z" });

  assert.notEqual(subscriber.authorId, "UC-member");
  assert.notEqual(superchat.authorId, "UC-supporter");
  assert.equal(mapper.map({ id: "again", type: "subscriber", author: "Member", authorId: "UC-member", occurredAt: "2026-08-22T00:00:00.000Z" }).authorId, subscriber.authorId);
});

test("retains an evicted participant identity for the active quiz round", () => {
  const mapper = new ParticipantIdentityMapper(1);
  const first = mapper.map({ id: "first", type: "chat", author: "One", authorId: "UC-one", message: "2", occurredAt: "2026-08-22T00:00:00.000Z" });
  mapper.map({ id: "second", type: "chat", author: "Two", authorId: "UC-two", message: "1", occurredAt: "2026-08-22T00:00:00.000Z" });
  const repeated = mapper.map({ id: "third", type: "chat", author: "One", authorId: "UC-one", message: "3", occurredAt: "2026-08-22T00:00:00.000Z" });

  assert.equal(repeated.authorId, first.authorId);
  mapper.startRound();
  assert.notEqual(mapper.map({ id: "fourth", type: "chat", author: "One", authorId: "UC-one", message: "4", occurredAt: "2026-08-22T00:00:00.000Z" }).id, repeated.id);
});
