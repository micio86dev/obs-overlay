import assert from "node:assert/strict";
import test from "node:test";
import { normalizeYouTubeMessage } from "../src/sources/youtube-normalize.ts";

const authorDetails = { channelId: "channel-1", displayName: "Micio", profileImageUrl: "https://example.test/avatar" };
function message(type: string, details: Record<string, unknown>, overrides: Record<string, unknown> = {}): Parameters<typeof normalizeYouTubeMessage>[0] {
  return { id: `message-${type}`, authorDetails, snippet: { type, publishedAt: "2026-08-23T12:00:00.000Z", ...details }, ...overrides };
}

test("normalizes documented paid membership variants", () => {
  const sticker = normalizeYouTubeMessage(message("superStickerEvent", { superStickerDetails: { amountDisplayString: "€2", amountMicros: 2_000_000, currency: "EUR", superStickerMetadata: { stickerId: "sticker", altText: "Cat" } } }));
  const milestone = normalizeYouTubeMessage(message("memberMilestoneChatEvent", { memberMilestoneChatDetails: { memberMonth: 12, userComment: "Hi" } }));
  assert.deepEqual(sticker && { type: sticker.type, amount: sticker.type === "supersticker" ? sticker.amount : "", alt: sticker.type === "supersticker" ? sticker.stickerAltText : "" }, { type: "supersticker", amount: "€2", alt: "Cat" });
  assert.deepEqual(milestone && { type: milestone.type, months: milestone.type === "member-milestone" ? milestone.memberMonths : 0 }, { type: "member-milestone", months: 12 });
  assert.equal(normalizeYouTubeMessage(message("superStickerEvent", {})), undefined);
});

test("reads the membership gift tier from the documented giftMembershipsLevelName field", () => {
  const gift = normalizeYouTubeMessage(message("membershipGiftingEvent", { membershipGiftingDetails: { giftMembershipsCount: 5, giftMembershipsLevelName: "Crew" } }));
  assert.deepEqual(gift && { count: gift.type === "membership-gift" ? gift.membershipCount : 0, level: gift.type === "membership-gift" ? gift.levelName : "" }, { count: 5, level: "Crew" });
});

test("carries the recipient tier of a single gifted membership", () => {
  const received = normalizeYouTubeMessage(message("giftMembershipReceivedEvent", { giftMembershipReceivedDetails: { memberLevelName: "Crew", gifterChannelId: "channel-gifter" } }));
  assert.deepEqual(received && { type: received.type, count: received.type === "membership-gift-received" ? received.recipientCount : 0, level: received.type === "membership-gift-received" ? received.levelName : "" }, { type: "membership-gift-received", count: 1, level: "Crew" });
});

test("reads a poll from snippet.pollDetails.metadata including official vote tallies", () => {
  const poll = normalizeYouTubeMessage(message("pollEvent", { pollDetails: { metadata: { status: "closed", questionText: "Ship?", options: [{ optionText: "Yes", tally: 27 }, { optionText: "No", tally: 3 }] } } }));
  assert.deepEqual(poll && poll.type === "poll" ? { status: poll.pollStatus, question: poll.question, choices: poll.choices } : undefined, {
    status: "ended",
    question: "Ship?",
    choices: [{ text: "Yes", tally: 27 }, { text: "No", tally: 3 }],
  });
});

test("an open poll stays active and tolerates a missing tally", () => {
  const poll = normalizeYouTubeMessage(message("pollEvent", { pollDetails: { metadata: { status: "active", questionText: "Ship?", options: [{ optionText: "Yes" }] } } }));
  assert.deepEqual(poll && poll.type === "poll" ? { status: poll.pollStatus, choices: poll.choices } : undefined, { status: "active", choices: [{ text: "Yes" }] });
  assert.equal(normalizeYouTubeMessage(message("pollEvent", { pollDetails: {} })), undefined);
});

test("a tombstone deletes its own message id without colliding with it", () => {
  const tombstone = normalizeYouTubeMessage({ id: "message-42", snippet: { type: "tombstone", publishedAt: "2026-08-23T12:00:00.000Z" } });

  assert.equal(tombstone?.type, "chat-moderation");
  assert.equal(tombstone?.type === "chat-moderation" && tombstone.moderationAction, "deleted");
  assert.equal(tombstone?.type === "chat-moderation" && tombstone.targetMessageId, "message-42");
  assert.notEqual(tombstone?.id, "message-42");
});

test("normalizes moderation without trusting malformed fields", () => {
  const deleted = normalizeYouTubeMessage(message("messageDeletedEvent", { messageDeletedDetails: { deletedMessageId: "message-old" } }));
  assert.deepEqual(deleted && { type: deleted.type, action: deleted.type === "chat-moderation" ? deleted.moderationAction : "", id: deleted.type === "chat-moderation" ? deleted.targetMessageId : "" }, { type: "chat-moderation", action: "deleted", id: "message-old" });
});

test("a ban carries the banned channel so the overlay can retract their backlog", () => {
  const banned = normalizeYouTubeMessage(message("userBannedEvent", { userBannedDetails: { bannedUserDetails: { channelId: "channel-spammer" }, banType: "permanent" } }));
  assert.equal(banned?.type === "chat-moderation" && banned.moderationAction, "banned");
  assert.equal(banned?.type === "chat-moderation" && banned.bannedAuthorId, "channel-spammer");
});

test("carries the official author role flags", () => {
  const chat = normalizeYouTubeMessage(message("textMessageEvent", { displayMessage: "hi" }, { authorDetails: { ...authorDetails, isChatOwner: true, isChatModerator: false, isChatSponsor: true, isVerified: false } }));
  assert.deepEqual(chat && { owner: chat.isOwner, moderator: chat.isModerator, member: chat.isMember, verified: chat.isVerified }, { owner: true, moderator: false, member: true, verified: false });
  assert.equal(normalizeYouTubeMessage(message("textMessageEvent", { displayMessage: "hi" }))?.isOwner, undefined);
});

test("ignores documented types the API does not describe a payload for", () => {
  assert.equal(normalizeYouTubeMessage(message("giftEvent", {})), undefined);
});
