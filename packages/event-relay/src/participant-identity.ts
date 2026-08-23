import { randomUUID } from "node:crypto";
import type { OverlayEvent } from "@miciodev/shared-types";

/** Replaces provider identifiers before an event can cross the relay boundary. */
export class ParticipantIdentityMapper {
  private readonly ids = new Map<string, string>();
  private readonly roundIds = new Map<string, string>();
  private readonly publicEventIds = new Map<string, string>();

  public constructor(private readonly maxEntries = 5_000) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error("maxEntries must be a positive integer");
  }

  /** Clears only at a shared quiz-round boundary, never while votes are accepted. */
  public startRound(): void { this.roundIds.clear(); }

  /** Allocates or reuses the opaque ID for a provider channel, bounded by insertion order. */
  private participantFor(providerId: string): string {
    const participantId = this.roundIds.get(providerId) ?? this.ids.get(providerId) ?? `participant-${randomUUID()}`;
    this.ids.set(providerId, participantId);
    this.roundIds.set(providerId, participantId);
    if (this.ids.size > this.maxEntries) {
      const oldest = this.ids.keys().next().value;
      if (typeof oldest === "string") this.ids.delete(oldest);
    }
    return participantId;
  }

  public map(event: OverlayEvent): OverlayEvent {
    const participantId = this.participantFor(event.authorId?.trim() || event.author.trim());
    const publicEventId = `event-${randomUUID()}`;
    this.publicEventIds.set(event.id, publicEventId);
    if (this.publicEventIds.size > this.maxEntries) {
      const oldest = this.publicEventIds.keys().next().value;
      if (typeof oldest === "string") this.publicEventIds.delete(oldest);
    }
    if (event.type === "chat-moderation") {
      return {
        ...event,
        id: publicEventId,
        authorId: participantId,
        targetMessageId: event.targetMessageId ? this.publicEventIds.get(event.targetMessageId) : undefined,
        bannedAuthorId: event.bannedAuthorId ? this.participantFor(event.bannedAuthorId.trim()) : undefined,
      };
    }
    return { ...event, id: publicEventId, authorId: participantId };
  }
}
