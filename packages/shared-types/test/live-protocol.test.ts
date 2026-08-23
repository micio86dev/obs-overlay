import assert from "node:assert/strict";
import test from "node:test";
import { isOverlayEvent, isRelayMessage } from "../src/index.ts";

const base = { id: "event-1", occurredAt: "2026-08-23T12:00:00.000Z", author: "viewer" };

test("validates the additional official live chat event variants", () => {
  assert.equal(isOverlayEvent({ ...base, type: "supersticker", amount: "€2.00", currency: "EUR", stickerAltText: "Sticker" }), true);
  assert.equal(isOverlayEvent({ ...base, type: "member-milestone", memberMonths: 12, message: "Hello" }), true);
  assert.equal(isOverlayEvent({ ...base, type: "membership-gift", membershipCount: 5, levelName: "Level 1" }), true);
  assert.equal(isOverlayEvent({ ...base, type: "membership-gift-received", recipientCount: 3 }), true);
  assert.equal(isOverlayEvent({ ...base, type: "poll", pollStatus: "ended", question: "TypeScript?", choices: [{ text: "Yes", tally: 12 }, { text: "No" }] }), true);
  assert.equal(isOverlayEvent({ ...base, type: "chat-moderation", moderationAction: "deleted", targetMessageId: "message-1" }), true);
  assert.equal(isOverlayEvent({ ...base, type: "chat-mode", chatMode: "members-only", enabled: true }), true);
});

test("poll choices carry official vote tallies and reject legacy or malformed shapes", () => {
  assert.equal(isOverlayEvent({ ...base, type: "poll", pollStatus: "active", question: "Ship?", choices: ["Yes"] }), false);
  assert.equal(isOverlayEvent({ ...base, type: "poll", pollStatus: "active", question: "Ship?", choices: [{ text: "Yes", tally: -1 }] }), false);
  assert.equal(isOverlayEvent({ ...base, type: "poll", pollStatus: "active", question: "Ship?", choices: [] }), true);
});

test("a ban carries the moderated author so the overlay can retract their backlog", () => {
  assert.equal(isOverlayEvent({ ...base, type: "chat-moderation", moderationAction: "banned", bannedAuthorId: "participant-1" }), true);
  assert.equal(isOverlayEvent({ ...base, type: "chat-moderation", moderationAction: "banned", bannedAuthorId: 42 }), false);
});

test("author role flags are optional booleans on every event", () => {
  assert.equal(isOverlayEvent({ ...base, type: "chat", message: "hi", isOwner: true, isModerator: false, isMember: true, isVerified: false }), true);
  assert.equal(isOverlayEvent({ ...base, type: "chat", message: "hi", isModerator: "yes" }), false);
});

test("accepts a state envelope while retaining raw event backwards compatibility", () => {
  assert.equal(isRelayMessage({ kind: "event", event: { ...base, type: "chat", message: "hello" } }), true);
  assert.equal(isRelayMessage({ kind: "state", state: { status: "live", broadcastId: "video-1", concurrentViewers: 128, peakViewers: 128, session: { chatMessages: 3, superChatCount: 0, superStickerCount: 0, newMembers: 0, giftedMemberships: 0, superChatRevenueMicros: {} } } }), true);
  assert.equal(isRelayMessage({ kind: "state", state: { status: "live", subscriberCount: 4_200, session: { chatMessages: 0, superChatCount: 0, superStickerCount: 0, newMembers: 0, giftedMemberships: 0, superChatRevenueMicros: {} } } }), true);
  assert.equal(isRelayMessage({ kind: "state", state: { status: "live", subscriberCount: -1, session: { chatMessages: 0, superChatCount: 0, superStickerCount: 0, newMembers: 0, giftedMemberships: 0, superChatRevenueMicros: {} } } }), false);
  assert.equal(isRelayMessage({ kind: "state", state: { status: "live", streamHealth: "unsafe", session: { chatMessages: 0, superChatCount: 0, superStickerCount: 0, newMembers: 0, giftedMemberships: 0, superChatRevenueMicros: {} } } }), false);
  assert.equal(isRelayMessage({ kind: "state", state: { status: ["live"], streamHealth: { toString: () => "good" }, session: { chatMessages: 0, superChatCount: 0, superStickerCount: 0, newMembers: 0, giftedMemberships: 0, superChatRevenueMicros: {} } } }), false);
  assert.equal(isRelayMessage({ kind: "state", state: { status: "wrong" } }), false);
});
