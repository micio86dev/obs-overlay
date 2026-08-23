import { describe, expect, it } from "vitest";
import type { ChatEvent } from "@miciodev/shared-types";
import { createFloatingReactions, extractEmoji } from "./emoji-reactions";

function chat(message: string, id = "msg-1"): ChatEvent {
  return { id, type: "chat", occurredAt: "2026-08-23T12:00:00.000Z", author: "Viewer", message };
}

describe("extractEmoji", () => {
  it("finds every emoji in a message and ignores plain text", () => {
    expect(extractEmoji("great stream ❤️🔥 keep it up")).toEqual(["❤️", "🔥"]);
  });

  it("returns nothing for a message with no emoji", () => {
    expect(extractEmoji("shipping clean code, one commit at a time")).toEqual([]);
  });

  it("caps a spammy message instead of flooding the screen", () => {
    expect(extractEmoji("❤️".repeat(20))).toHaveLength(5);
  });
});

describe("createFloatingReactions", () => {
  it("creates one reaction per emoji, positioned and sized within their documented ranges", () => {
    const reactions = createFloatingReactions(chat("so good 🔥🔥"), () => 0.5);

    expect(reactions).toHaveLength(2);
    expect(reactions[0].id).toBe("msg-1-0");
    expect(reactions[1].id).toBe("msg-1-1");
    for (const reaction of reactions) {
      expect(reaction.emoji).toBe("🔥");
      expect(reaction.left).toBeGreaterThanOrEqual(6);
      expect(reaction.left).toBeLessThanOrEqual(94);
      expect(reaction.durationMs).toBeGreaterThanOrEqual(4_200);
      expect(reaction.durationMs).toBeLessThanOrEqual(6_800);
      expect(reaction.sizeRem).toBeGreaterThanOrEqual(2.2);
      expect(reaction.sizeRem).toBeLessThanOrEqual(3.4);
    }
  });

  it("returns nothing for an emoji-free message", () => {
    expect(createFloatingReactions(chat("no emoji here"))).toEqual([]);
  });
});
