import type { OverlayEvent } from "@miciodev/shared-types";

export type AlertEvent = Exclude<OverlayEvent, { type: "chat" | "chat-moderation" }>;
export function isAlertEvent(event: OverlayEvent): event is AlertEvent { return event.type !== "chat" && event.type !== "chat-moderation"; }
function priority(event: AlertEvent): number {
  if (event.type === "membership-gift") return 3;
  if (event.type === "superchat" || event.type === "supersticker" || event.type === "subscriber") return 2;
  return 1;
}
/** Stable priority ordering avoids competing alert animations. */
export function orderAlerts<T extends AlertEvent>(events: readonly T[]): T[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((left, right) => priority(right.event) - priority(left.event) || left.index - right.index)
    .map(({ event }) => event);
}
interface QueueEntry { event: AlertEvent; queuedAt: number; sequence: number; }

/** Bounded, priority-aware backpressure for long-running OBS Browser Sources. */
export class BoundedAlertQueue {
  private entries: QueueEntry[] = [];
  private sequence = 0;

  public constructor(private readonly maxSize = 12, private readonly lowPriorityMaxAgeMs = 20_000) {
    const validSize = Number.isInteger(maxSize) && maxSize >= 1;
    const validAge = Number.isFinite(lowPriorityMaxAgeMs) && lowPriorityMaxAgeMs >= 0;
    if (!validSize || !validAge) throw new Error("Invalid alert queue limits");
  }

  public get items(): AlertEvent[] { return this.entries.map(({ event }) => event); }

  public enqueue(event: AlertEvent, now = Date.now()): void {
    this.prune(now);
    if (event.type === "membership-gift-received") {
      const existing = this.entries.find((entry) => entry.event.type === "membership-gift-received");
      if (existing?.event.type === "membership-gift-received") {
        existing.event = { ...existing.event, recipientCount: existing.event.recipientCount + event.recipientCount };
        this.sort();
        return;
      }
    }
    this.entries.push({ event, queuedAt: now, sequence: this.sequence++ });
    this.sort();
    while (this.entries.length > this.maxSize) this.entries.pop();
  }

  public take(now = Date.now()): AlertEvent | undefined {
    this.prune(now);
    return this.entries.shift()?.event;
  }

  /** Low-priority alerts go stale; a Super Chat from ten minutes ago never should. */
  private prune(now: number): void {
    this.entries = this.entries.filter((entry) => priority(entry.event) > 1 || now - entry.queuedAt <= this.lowPriorityMaxAgeMs);
  }

  private sort(): void {
    this.entries.sort((left, right) => priority(right.event) - priority(left.event) || left.sequence - right.sequence);
  }
}
