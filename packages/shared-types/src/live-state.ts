import type { OverlayEvent } from "./events.js";

export type BroadcastStatus = "upcoming" | "testing" | "live" | "complete" | "offline" | "unknown";
export type StreamHealth = "good" | "ok" | "warning" | "error" | "unknown";
export interface LiveSessionMetrics {
  chatMessages: number;
  superChatCount: number;
  superStickerCount: number;
  newMembers: number;
  giftedMemberships: number;
  superChatRevenueMicros: Record<string, number>;
}

export interface LiveState {
  broadcastId?: string;
  status: BroadcastStatus;
  concurrentViewers?: number;
  peakViewers?: number;
  startedAt?: string;
  scheduledStartAt?: string;
  endedAt?: string;
  streamHealth?: StreamHealth;
  session: LiveSessionMetrics;
}

export interface RelayEventMessage {
  kind: "event";
  event: OverlayEvent;
}

export interface RelayStateMessage {
  kind: "state";
  state: LiveState;
}
export type RelayMessage = RelayEventMessage | RelayStateMessage;
