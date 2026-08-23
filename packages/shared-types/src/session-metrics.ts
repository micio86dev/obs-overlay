import type { OverlayEvent } from "./events.js";
import type { LiveSessionMetrics } from "./live-state.js";

export function recordSessionMetrics(session: LiveSessionMetrics, event: OverlayEvent): LiveSessionMetrics {
  const next = { ...session, superChatRevenueMicros: { ...session.superChatRevenueMicros } };
  if (event.type === "chat") next.chatMessages += 1;
  if (event.type === "superchat") {
    next.superChatCount += 1;
    if (event.amountMicros !== undefined && event.currency) {
      const previous = next.superChatRevenueMicros[event.currency] ?? 0;
      next.superChatRevenueMicros[event.currency] = previous + event.amountMicros;
    }
  }
  if (event.type === "supersticker") next.superStickerCount += 1;
  if (event.type === "subscriber") next.newMembers += 1;
  if (event.type === "membership-gift") next.giftedMemberships += event.membershipCount;
  return next;
}

export function createEmptySessionMetrics(): LiveSessionMetrics {
  return {
    chatMessages: 0,
    superChatCount: 0,
    superStickerCount: 0,
    newMembers: 0,
    giftedMemberships: 0,
    superChatRevenueMicros: {},
  };
}
