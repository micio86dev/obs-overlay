import assert from "node:assert/strict";
import test from "node:test";
import { ParticipantIdentityMapper } from "../src/participant-identity.js";

test("replaces a provider channel ID with a stable per-process opaque participant ID", () => {
  const mapper = new ParticipantIdentityMapper();
  const event = { id: "message", type: "chat" as const, author: "Viewer", authorId: "UC-private-channel", avatarUrl: "https://yt3.example/avatar.jpg", message: "2", occurredAt: "2026-08-22T00:00:00.000Z" };
  const first = mapper.map(event);
  const second = mapper.map({ ...event, id: "message-2" });

  assert.notEqual(first.authorId, event.authorId);
  assert.match(first.authorId ?? "", /^participant-[0-9a-f-]{36}$/);
  assert.equal(second.authorId, first.authorId);
  assert.notEqual(first.id, event.id);
});

test("keeps the public display name and avatar that YouTube already shows in live chat", () => {
  const mapper = new ParticipantIdentityMapper();
  const mapped = mapper.map({ id: "message", type: "superchat", author: "MicioFan", authorId: "UC-private-channel", avatarUrl: "https://yt3.example/avatar.jpg", amount: "€5", currency: "EUR", message: "Hi", occurredAt: "2026-08-22T00:00:00.000Z", isMember: true });

  assert.equal(mapped.author, "MicioFan");
  assert.equal(mapped.avatarUrl, "https://yt3.example/avatar.jpg");
  assert.equal(mapped.isMember, true);
});

test("a ban remaps the moderated channel onto its opaque participant ID", () => {
  const mapper = new ParticipantIdentityMapper();
  const chat = mapper.map({ id: "message", type: "chat", author: "Spammer", authorId: "UC-spammer", message: "spam", occurredAt: "2026-08-22T00:00:00.000Z" });
  const ban = mapper.map({ id: "ban", type: "chat-moderation", moderationAction: "banned", author: "Moderator", authorId: "UC-moderator", bannedAuthorId: "UC-spammer", occurredAt: "2026-08-22T00:00:00.000Z" });

  assert.equal(ban.type === "chat-moderation" && ban.bannedAuthorId, chat.authorId);
  assert.notEqual(ban.type === "chat-moderation" && ban.bannedAuthorId, "UC-spammer");
});

test("a ban for an unseen channel never leaks the raw provider identity", () => {
  const mapper = new ParticipantIdentityMapper();
  const ban = mapper.map({ id: "ban", type: "chat-moderation", moderationAction: "banned", author: "Moderator", authorId: "UC-moderator", bannedAuthorId: "UC-never-seen", occurredAt: "2026-08-22T00:00:00.000Z" });

  assert.notEqual(ban.type === "chat-moderation" && ban.bannedAuthorId, "UC-never-seen");
  assert.match(ban.type === "chat-moderation" ? ban.bannedAuthorId ?? "" : "", /^participant-[0-9a-f-]{36}$/);
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
