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
});
