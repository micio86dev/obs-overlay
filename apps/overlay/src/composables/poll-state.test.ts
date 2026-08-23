import { describe, expect, it } from "vitest";
import type { OverlayEvent } from "@miciodev/shared-types";
import { pollChoiceShares, selectVisiblePoll } from "./poll-state";

const at = "2026-08-23T12:00:00.000Z";
const now = Date.parse(at);

function poll(overrides: Partial<Extract<OverlayEvent, { type: "poll" }>> = {}): OverlayEvent {
  return { id: "poll-1", type: "poll", occurredAt: at, author: "Micio", pollStatus: "active", question: "Ship?", choices: [{ text: "Yes", tally: 3 }, { text: "No", tally: 1 }], ...overrides };
}

describe("selectVisiblePoll", () => {
  it("shows the most recent active poll", () => {
    const events = [poll({ id: "poll-1" }), poll({ id: "poll-2", question: "Deploy?" })];
    expect(selectVisiblePoll(events, now)?.question).toBe("Deploy?");
  });

  it("keeps an ended poll on screen only for its result grace period", () => {
    const events = [poll({ pollStatus: "ended" })];
    expect(selectVisiblePoll(events, now + 3_000)?.pollStatus).toBe("ended");
    expect(selectVisiblePoll(events, now + 30_000)).toBeUndefined();
  });

  it("returns nothing when no poll has been seen", () => {
    expect(selectVisiblePoll([{ id: "chat-1", type: "chat", occurredAt: at, author: "A", message: "hi" }], now)).toBeUndefined();
  });

  it("never resurrects an older poll after the latest one ends", () => {
    const events = [poll({ id: "poll-1" }), poll({ id: "poll-2", pollStatus: "ended" })];
    expect(selectVisiblePoll(events, now + 30_000)).toBeUndefined();
  });
});

describe("pollChoiceShares", () => {
  it("converts tallies into whole percentages", () => {
    expect(pollChoiceShares([{ text: "Yes", tally: 3 }, { text: "No", tally: 1 }])).toEqual([
      { text: "Yes", tally: 3, share: 75 },
      { text: "No", tally: 1, share: 25 },
    ]);
  });

  it("reports no share when the API omitted every tally", () => {
    expect(pollChoiceShares([{ text: "Yes" }, { text: "No" }])).toEqual([
      { text: "Yes", tally: undefined, share: undefined },
      { text: "No", tally: undefined, share: undefined },
    ]);
  });

  it("treats a zero-vote poll as an even absence of votes rather than dividing by zero", () => {
    expect(pollChoiceShares([{ text: "Yes", tally: 0 }, { text: "No", tally: 0 }])).toEqual([
      { text: "Yes", tally: 0, share: 0 },
      { text: "No", tally: 0, share: 0 },
    ]);
  });
});
