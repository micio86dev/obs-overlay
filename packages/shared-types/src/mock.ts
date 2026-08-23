import type { OverlayEvent, OverlayEventType } from "./events.js";

/** Every event type worth previewing before a real donation or membership arrives. */
export const demoEventTypes: OverlayEventType[] = [
  "chat",
  "subscriber",
  "superchat",
  "supersticker",
  "member-milestone",
  "membership-gift",
  "membership-gift-received",
  "poll",
  "chat-moderation",
  "chat-mode",
];

/** Self-contained circle avatars (no network dependency) so the demo preview isn't the only surface missing a profile picture. */
const demoAvatarColors = ["%2365ff8f", "%23a4ffbd", "%2318b64c"];
function demoAvatarUrl(index: number): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='${demoAvatarColors[index]}'/%3E%3C/svg%3E`;
}

export function createMockEvent(type: OverlayEventType, sequence: number): OverlayEvent {
  const authorIndex = sequence % 3;
  const base = {
    id: `mock-${type}-${sequence}`,
    occurredAt: new Date().toISOString(),
    author: ["MicioFan", "CodeCat", "PixelPaws"][authorIndex],
    avatarUrl: demoAvatarUrl(authorIndex)
  };

  if (type === "chat") return { ...base, type, message: "Shipping clean code, one commit at a time. ❤️🔥" };
  if (type === "subscriber") return { ...base, type, message: "Joined the MicioDev crew" };
  if (type === "superchat") return { ...base, type, amount: "€5.00", currency: "EUR", amountMicros: 5_000_000, message: "Great tutorial, thanks!" };
  if (type === "supersticker") return { ...base, type, amount: "€2.00", currency: "EUR", amountMicros: 2_000_000, stickerAltText: "Cat hype sticker" };
  if (type === "member-milestone") return { ...base, type, memberMonths: 12, message: "A year with the crew!" };
  if (type === "membership-gift") return { ...base, type, membershipCount: 5, levelName: "Crew" };
  if (type === "membership-gift-received") return { ...base, type, recipientCount: 1 };
  if (type === "poll") return { ...base, type, pollStatus: "active", question: "Ship it?", choices: [{ text: "Yes", tally: 12 }, { text: "Absolutely", tally: 27 }] };
  if (type === "chat-moderation") return { ...base, type, moderationAction: "deleted" };
  return { ...base, type, chatMode: "members-only", enabled: true };
}
