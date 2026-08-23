import type { ChatEvent, ChatModerationEvent, OverlayEvent } from "@miciodev/shared-types";

/** Applies relay-normalized moderation before the feed renders anything. */
export function selectChatEvents(events: OverlayEvent[], maxVisible: number): ChatEvent[] {
  const moderation = events.filter((event): event is ChatModerationEvent => event.type === "chat-moderation");
  const deletedIds = new Set(moderation.filter((event) => event.moderationAction === "deleted" && event.targetMessageId).map((event) => event.targetMessageId));
  const bannedAuthorIds = new Set(moderation.filter((event) => event.moderationAction === "banned" && event.bannedAuthorId).map((event) => event.bannedAuthorId));
  return events
    .filter((event): event is ChatEvent => event.type === "chat" && !deletedIds.has(event.id) && !(event.authorId !== undefined && bannedAuthorIds.has(event.authorId)))
    .slice(-maxVisible);
}
