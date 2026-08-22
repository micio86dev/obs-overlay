import { randomUUID } from "node:crypto";
import type { OverlayEvent } from "@miciodev/shared-types";

/** Replaces provider identifiers before an event can cross the relay boundary. */
export class ParticipantIdentityMapper {
  private readonly ids = new Map<string, string>();
  private readonly roundIds = new Map<string, string>();

  public constructor(private readonly maxEntries = 5_000) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error("maxEntries must be a positive integer");
  }

  /** Clears only at a shared quiz-round boundary, never while votes are accepted. */
  public startRound(): void { this.roundIds.clear(); }

  public map(event: OverlayEvent): OverlayEvent {
    const providerId = event.authorId?.trim() || event.author.trim();
    const participantId = this.roundIds.get(providerId) ?? this.ids.get(providerId) ?? `participant-${randomUUID()}`;
    this.ids.set(providerId, participantId);
    this.roundIds.set(providerId, participantId);
    if (this.ids.size > this.maxEntries) {
      const oldest = this.ids.keys().next().value;
      if (typeof oldest === "string") this.ids.delete(oldest);
    }
    return {
      id: `event-${randomUUID()}`,
      type: event.type,
      occurredAt: event.occurredAt,
      author: `Viewer ${participantId.slice(-6)}`,
      authorId: participantId,
      ...(event.type === "chat" ? { message: event.message } : {}),
      ...(event.type === "subscriber" ? { message: event.message } : {}),
      ...(event.type === "superchat" ? { amount: event.amount, currency: event.currency, message: event.message } : {}),
    } as OverlayEvent;
  }
}
