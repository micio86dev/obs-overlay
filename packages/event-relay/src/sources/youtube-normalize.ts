import { isRecord, type OverlayEvent, type OverlayEventBase } from "@miciodev/shared-types";

/** The subset of a liveChatMessages resource this relay reads. */
export interface YouTubeMessage {
  id: string;
  snippet: Record<string, unknown>;
  authorDetails?: Record<string, unknown>;
}

export function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function isYouTubeMessage(value: unknown): value is YouTubeMessage {
  if (!isRecord(value) || typeof value.id !== "string" || !isRecord(value.snippet)) return false;
  return typeof value.snippet.type === "string"
    && typeof value.snippet.publishedAt === "string"
    && (value.authorDetails === undefined || isRecord(value.authorDetails));
}

function getNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function getDetail(record: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = record[key];
  return isRecord(value) ? value : undefined;
}

function getBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

/** Utility alias, not an object shape: an empty extending interface is banned by lint. */
type AuthorFlags = Partial<Pick<OverlayEventBase, "isOwner" | "isModerator" | "isMember" | "isVerified">>;

/** Only the flags the provider actually sent; an absent flag must stay absent, not become false. */
function getAuthorFlags(author: Record<string, unknown>): AuthorFlags {
  const flags = {
    isOwner: getBoolean(author, "isChatOwner"),
    isModerator: getBoolean(author, "isChatModerator"),
    isMember: getBoolean(author, "isChatSponsor"),
    isVerified: getBoolean(author, "isVerified"),
  };
  return Object.fromEntries(Object.entries(flags).filter(([, value]) => value !== undefined));
}

/** Converts only documented liveChatMessages variants into the shared internal protocol. */
export function normalizeYouTubeMessage(message: YouTubeMessage): OverlayEvent | undefined {
  const author = message.authorDetails ?? {};
  const base = {
    id: message.id,
    occurredAt: getString(message.snippet, "publishedAt") ?? new Date(0).toISOString(),
    author: getString(author, "displayName") ?? "YouTube viewer",
    authorId: getString(author, "channelId"),
    avatarUrl: getString(author, "profileImageUrl"),
    ...getAuthorFlags(author),
  };
  const type = getString(message.snippet, "type");
  if (type === "textMessageEvent") return { ...base, type: "chat", message: getString(message.snippet, "displayMessage") ?? "" };
  if (type === "newSponsorEvent") return { ...base, type: "subscriber", message: getString(message.snippet, "displayMessage") };
  if (type === "superChatEvent") {
    const detail = getDetail(message.snippet, "superChatDetails");
    if (!detail) return undefined;
    const amountMicros = getNumber(detail, "amountMicros");
    return {
      ...base,
      type: "superchat",
      amount: getString(detail, "amountDisplayString") ?? "Support",
      currency: getString(detail, "currency") ?? "",
      ...(amountMicros === undefined ? {} : { amountMicros }),
      message: getString(detail, "userComment") ?? "",
    };
  }
  if (type === "superStickerEvent") {
    const detail = getDetail(message.snippet, "superStickerDetails");
    if (!detail) return undefined;
    const metadata = getDetail(detail, "superStickerMetadata") ?? {};
    const amountMicros = getNumber(detail, "amountMicros");
    return {
      ...base,
      type: "supersticker",
      amount: getString(detail, "amountDisplayString") ?? "Support",
      currency: getString(detail, "currency") ?? "",
      ...(amountMicros === undefined ? {} : { amountMicros }),
      stickerAltText: getString(metadata, "altText"),
      stickerId: getString(metadata, "stickerId"),
    };
  }
  if (type === "memberMilestoneChatEvent") {
    const detail = getDetail(message.snippet, "memberMilestoneChatDetails");
    if (!detail) return undefined;
    return {
      ...base,
      type: "member-milestone",
      memberMonths: getNumber(detail, "memberMonth") ?? 0,
      message: getString(detail, "userComment"),
    };
  }
  if (type === "membershipGiftingEvent") {
    const detail = getDetail(message.snippet, "membershipGiftingDetails");
    if (!detail) return undefined;
    return {
      ...base,
      type: "membership-gift",
      membershipCount: getNumber(detail, "giftMembershipsCount") ?? 0,
      levelName: getString(detail, "giftMembershipsLevelName"),
    };
  }
  // YouTube emits one giftMembershipReceivedEvent per recipient; the overlay aggregates them.
  if (type === "giftMembershipReceivedEvent") {
    const detail = getDetail(message.snippet, "giftMembershipReceivedDetails") ?? {};
    return {
      ...base,
      type: "membership-gift-received",
      recipientCount: 1,
      levelName: getString(detail, "memberLevelName"),
    };
  }
  if (type === "pollEvent") {
    const metadata = getDetail(getDetail(message.snippet, "pollDetails") ?? {}, "metadata");
    if (!metadata) return undefined;
    const options = Array.isArray(metadata.options) ? metadata.options.filter(isRecord) : [];
    const choices = options
      .map((option) => {
        const tally = getNumber(option, "tally");
        return { text: getString(option, "optionText") ?? "", ...(tally === undefined ? {} : { tally }) };
      })
      .filter((choice) => choice.text.length > 0);
    return {
      ...base,
      type: "poll",
      pollStatus: getString(metadata, "status") === "closed" ? "ended" : "active",
      question: getString(metadata, "questionText") ?? getString(message.snippet, "displayMessage") ?? "Poll",
      choices,
    };
  }
  // A tombstone reuses the deleted message's ID, so the event needs its own to survive relay dedup.
  if (type === "tombstone") {
    return {
      ...base,
      id: `tombstone:${message.id}`,
      type: "chat-moderation",
      moderationAction: "deleted",
      targetMessageId: message.id,
    };
  }
  if (type === "messageDeletedEvent") {
    const detail = getDetail(message.snippet, "messageDeletedDetails") ?? {};
    return {
      ...base,
      type: "chat-moderation",
      moderationAction: "deleted",
      targetMessageId: getString(detail, "deletedMessageId"),
    };
  }
  if (type === "userBannedEvent") {
    const bannedUser = getDetail(getDetail(message.snippet, "userBannedDetails") ?? {}, "bannedUserDetails") ?? {};
    return {
      ...base,
      type: "chat-moderation",
      moderationAction: "banned",
      bannedAuthorId: getString(bannedUser, "channelId"),
    };
  }
  if (type === "chatEndedEvent") return { ...base, type: "chat-moderation", moderationAction: "ended" };
  if (type === "sponsorOnlyModeStartedEvent" || type === "sponsorOnlyModeEndedEvent") {
    return {
      ...base,
      type: "chat-mode",
      chatMode: "members-only",
      enabled: type.endsWith("StartedEvent"),
    };
  }
  return undefined;
}

