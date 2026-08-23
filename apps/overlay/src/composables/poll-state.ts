import type { OverlayEvent, PollChoice, PollEvent } from "@miciodev/shared-types";

/** How long a closed poll keeps its result on screen before the HUD retires it. */
export const pollResultGraceMs = 12_000;

export interface PollChoiceShare extends PollChoice { share?: number }

/**
 * Only ever the latest poll: YouTube re-sends the same poll as its tallies move, and an
 * OBS overlay must never accumulate stale question cards.
 */
export function selectVisiblePoll(events: readonly OverlayEvent[], now: number): PollEvent | undefined {
  const latest = events.filter((event): event is PollEvent => event.type === "poll").at(-1);
  if (!latest || latest.pollStatus !== "ended") return latest;
  const endedAt = Date.parse(latest.occurredAt);
  if (Number.isNaN(endedAt)) return undefined;
  return now - endedAt <= pollResultGraceMs ? latest : undefined;
}

export function pollChoiceShares(choices: readonly PollChoice[]): PollChoiceShare[] {
  const total = choices.reduce((sum, choice) => sum + (choice.tally ?? 0), 0);
  const hasTallies = choices.some((choice) => choice.tally !== undefined);
  return choices.map((choice) => ({
    ...choice,
    share: hasTallies ? (total === 0 ? 0 : Math.round(((choice.tally ?? 0) / total) * 100)) : undefined,
  }));
}
