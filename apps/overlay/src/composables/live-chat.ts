import type { ChatEvent, OverlayEvent } from "@miciodev/shared-types";

export function selectChatEvents(events: OverlayEvent[], maxVisible: number): ChatEvent[] {
  return events.filter((event): event is ChatEvent => event.type === "chat").slice(-maxVisible);
}
