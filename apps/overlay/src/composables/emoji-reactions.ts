import type { ChatEvent } from "@miciodev/shared-types";

const maxEmojiPerMessage = 5;
// The optional trailing ️ keeps a variation-selected glyph (e.g. "❤️" = U+2764 U+FE0F)
// as one match instead of splitting off a bare, text-style "❤".
const emojiPattern = /\p{Extended_Pictographic}️?/gu;

/** Every emoji glyph in a chat message, capped so one spammy message cannot flood the screen. */
export function extractEmoji(message: string): string[] {
  const matches = message.match(emojiPattern);
  return matches ? matches.slice(0, maxEmojiPerMessage) : [];
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  /** Horizontal start position, percent of the layout's width. */
  left: number;
  durationMs: number;
  sizeRem: number;
  /** Horizontal drift by the time it reaches the top, in rem — a light sway, not a straight line. */
  driftRem: number;
}

/** One floating reaction per emoji in the message; `random` is injectable so tests stay deterministic. */
export function createFloatingReactions(event: ChatEvent, random: () => number = Math.random): FloatingReaction[] {
  return extractEmoji(event.message).map((emoji, index) => ({
    id: `${event.id}-${index}`,
    emoji,
    left: 6 + random() * 88,
    durationMs: 4_200 + random() * 2_600,
    sizeRem: 2.2 + random() * 1.2,
    driftRem: (random() - 0.5) * 6,
  }));
}
