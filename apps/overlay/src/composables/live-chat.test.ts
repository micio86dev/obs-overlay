import { describe, expect, it } from "vitest";
import type { OverlayEvent } from "@miciodev/shared-types";
import { selectChatEvents } from "./live-chat";

describe("selectChatEvents", () => {
  it("filters non-chat events and retains the newest visible chat messages", () => {
    const events: OverlayEvent[] = [
      { id: "chat-1", type: "chat", occurredAt: "2026-08-22T00:00:00.000Z", author: "A", message: "first" },
      { id: "sub-1", type: "subscriber", occurredAt: "2026-08-22T00:00:01.000Z", author: "B" },
      { id: "chat-2", type: "chat", occurredAt: "2026-08-22T00:00:02.000Z", author: "C", message: "second" },
      { id: "chat-3", type: "chat", occurredAt: "2026-08-22T00:00:03.000Z", author: "D", message: "third" },
    ];

    expect(selectChatEvents(events, 2).map((event) => event.id)).toEqual(["chat-2", "chat-3"]);
  });

  it("removes a chat item after a relay-normalized deletion", () => {
    const events = [
      { id: "chat-1", type: "chat", occurredAt: "2026-08-23T12:00:00.000Z", author: "Viewer 1", message: "remove me" },
      { id: "moderation-1", type: "chat-moderation", occurredAt: "2026-08-23T12:00:01.000Z", author: "Viewer 2", moderationAction: "deleted", targetMessageId: "chat-1" },
    ] as const;
    expect(selectChatEvents([...events], 7)).toEqual([]);
  });

  it("retracts the backlog of a banned author", () => {
    const events = [
      { id: "chat-1", type: "chat", occurredAt: "2026-08-23T12:00:00.000Z", author: "Spammer", authorId: "participant-1", message: "spam" },
      { id: "chat-2", type: "chat", occurredAt: "2026-08-23T12:00:01.000Z", author: "Regular", authorId: "participant-2", message: "hello" },
      { id: "ban-1", type: "chat-moderation", occurredAt: "2026-08-23T12:00:02.000Z", author: "Moderator", moderationAction: "banned", bannedAuthorId: "participant-1" },
    ] as const;

    expect(selectChatEvents([...events], 7).map((event) => event.id)).toEqual(["chat-2"]);
  });

  it("keeps messages when a ban carries no author to act on", () => {
    const events = [
      { id: "chat-1", type: "chat", occurredAt: "2026-08-23T12:00:00.000Z", author: "Viewer", authorId: "participant-1", message: "hello" },
      { id: "ban-1", type: "chat-moderation", occurredAt: "2026-08-23T12:00:02.000Z", author: "Moderator", moderationAction: "banned" },
    ] as const;

    expect(selectChatEvents([...events], 7).map((event) => event.id)).toEqual(["chat-1"]);
  });
});
