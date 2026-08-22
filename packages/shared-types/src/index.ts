export type OverlayEventType = "chat" | "subscriber" | "superchat";

export interface OverlayEventBase {
  id: string;
  type: OverlayEventType;
  occurredAt: string;
  author: string;
  avatarUrl?: string;
}

export interface ChatEvent extends OverlayEventBase {
  type: "chat";
  message: string;
}

export interface SubscriberEvent extends OverlayEventBase {
  type: "subscriber";
  message?: string;
}

export interface SuperChatEvent extends OverlayEventBase {
  type: "superchat";
  amount: string;
  currency: string;
  message: string;
}

export type OverlayEvent = ChatEvent | SubscriberEvent | SuperChatEvent;

export function isOverlayEvent(value: unknown): value is OverlayEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<OverlayEvent>;
  return typeof event.id === "string"
    && typeof event.author === "string"
    && typeof event.occurredAt === "string"
    && (event.type === "chat" || event.type === "subscriber" || event.type === "superchat");
}

export function createMockEvent(type: OverlayEventType, sequence: number): OverlayEvent {
  const base = {
    id: `mock-${type}-${sequence}`,
    occurredAt: new Date().toISOString(),
    author: ["MicioFan", "CodeCat", "PixelPaws"][sequence % 3]
  };

  if (type === "chat") return { ...base, type, message: "Shipping clean code, one commit at a time." };
  if (type === "subscriber") return { ...base, type, message: "Joined the MicioDev crew" };
  return { ...base, type, amount: "€5.00", currency: "EUR", message: "Great tutorial, thanks!" };
}
