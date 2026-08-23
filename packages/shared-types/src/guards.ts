import type { OverlayEvent, PollChoice } from "./events.js";
import type { LiveState, RelayMessage } from "./live-state.js";

function isNonNegativeInteger(value: unknown): boolean {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}
function isPollChoice(value: unknown): value is PollChoice {
  return isRecord(value) && typeof value.text === "string" && (value.tally === undefined || isNonNegativeInteger(value.tally));
}

export function isOverlayEvent(value: unknown): value is OverlayEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<OverlayEvent>;
  const hasBaseShape = typeof event.id === "string"
    && typeof event.author === "string"
    && typeof event.occurredAt === "string"
    && !Number.isNaN(Date.parse(event.occurredAt))
    && [event.isOwner, event.isModerator, event.isMember, event.isVerified].every(isOptionalBoolean);
  if (!hasBaseShape) return false;

  if (event.type === "chat") return typeof event.message === "string"
    && (event.authorId === undefined || typeof event.authorId === "string");
  if (event.type === "subscriber") return event.message === undefined || typeof event.message === "string";
  if (event.type === "superchat") {
    return typeof event.amount === "string"
      && typeof event.currency === "string"
      && typeof event.message === "string"
      && (event.amountMicros === undefined || isNonNegativeInteger(event.amountMicros));
  }
  if (event.type === "supersticker") {
    return typeof event.amount === "string"
      && typeof event.currency === "string"
      && isOptionalString(event.stickerAltText)
      && isOptionalString(event.stickerId)
      && (event.amountMicros === undefined || isNonNegativeInteger(event.amountMicros));
  }
  if (event.type === "member-milestone") {
    return isNonNegativeInteger(event.memberMonths) && isOptionalString(event.message);
  }
  if (event.type === "membership-gift") {
    return isNonNegativeInteger(event.membershipCount) && isOptionalString(event.levelName);
  }
  if (event.type === "membership-gift-received") {
    return isNonNegativeInteger(event.recipientCount) && isOptionalString(event.levelName);
  }
  if (event.type === "poll") {
    return (event.pollStatus === "active" || event.pollStatus === "ended")
      && typeof event.question === "string"
      && Array.isArray(event.choices)
      && event.choices.every(isPollChoice);
  }
  if (event.type === "chat-moderation") {
    const action = event.moderationAction;
    return (action === "deleted" || action === "banned" || action === "ended")
      && isOptionalString(event.targetMessageId)
      && isOptionalString(event.bannedAuthorId);
  }
  if (event.type !== "chat-mode") return false;
  const mode = event.chatMode;
  return (mode === "members-only" || mode === "subscribers-only" || mode === "unknown")
    && typeof event.enabled === "boolean";
}

const broadcastStatuses = ["upcoming", "testing", "live", "complete", "offline", "unknown"];
const streamHealths = ["good", "ok", "warning", "error", "unknown"];

function hasValidSessionMetrics(session: Record<string, unknown>): boolean {
  const counters = [
    session.chatMessages,
    session.superChatCount,
    session.superStickerCount,
    session.newMembers,
    session.giftedMemberships,
  ];
  return counters.every(isNonNegativeInteger)
    && isRecord(session.superChatRevenueMicros)
    && Object.values(session.superChatRevenueMicros).every(isNonNegativeInteger);
}

export function isLiveState(value: unknown): value is LiveState {
  if (!isRecord(value) || typeof value.status !== "string") return false;
  if (!broadcastStatuses.includes(value.status) || !isRecord(value.session)) return false;
  if (!hasValidSessionMetrics(value.session)) return false;

  const timestamps = [value.broadcastId, value.startedAt, value.scheduledStartAt, value.endedAt];
  const hasValidHealth = value.streamHealth === undefined
    || (typeof value.streamHealth === "string" && streamHealths.includes(value.streamHealth));
  return timestamps.every(isOptionalString)
    && (value.concurrentViewers === undefined || isNonNegativeInteger(value.concurrentViewers))
    && (value.peakViewers === undefined || isNonNegativeInteger(value.peakViewers))
    && hasValidHealth;
}

export function isRelayMessage(value: unknown): value is RelayMessage {
  if (!isRecord(value)) return false;
  if (value.kind === "event") return isOverlayEvent(value.event);
  return value.kind === "state" && isLiveState(value.state);
}
