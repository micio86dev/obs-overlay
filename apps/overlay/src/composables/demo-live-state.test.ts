import { describe, expect, it } from "vitest";
import { demoEventTypes } from "@miciodev/shared-types/mock";
import { demoLiveState } from "./demo-live-state";

const now = Date.parse("2026-08-23T12:00:00.000Z");

describe("demoLiveState", () => {
  it("opens on a scheduled broadcast so the countdown segment is previewable", () => {
    const state = demoLiveState(0, now);

    expect(state.status).toBe("upcoming");
    expect(state.scheduledStartAt).toBeDefined();
    expect(state.concurrentViewers).toBeUndefined();
  });

  it("goes live with a start time and a viewer count", () => {
    const state = demoLiveState(3, now);

    expect(state.status).toBe("live");
    expect(Date.parse(state.startedAt ?? "")).toBeLessThanOrEqual(now);
    expect(state.concurrentViewers).toBeGreaterThan(0);
  });

  it("ramps viewers so peak tracking is visible", () => {
    const viewers = [3, 4, 5, 6].map((tick) => demoLiveState(tick, now).concurrentViewers ?? 0);
    expect(Math.max(...viewers)).toBeGreaterThan(Math.min(...viewers));
  });

  it("samples an unhealthy stream so that segment is previewable", () => {
    const healths = Array.from({ length: 40 }, (_, tick) => demoLiveState(tick, now).streamHealth);
    expect(healths).toContain("warning");
    expect(healths).toContain("good");
  });

  it("completes the broadcast with an end time so the timer freezes", () => {
    const state = demoLiveState(36, now);

    expect(state.status).toBe("complete");
    expect(state.endedAt).toBeDefined();
  });

  it("keeps one broadcast ID across the whole cycle so session metrics never reset mid-demo", () => {
    const ids = new Set([0, 5, 20, 36].map((tick) => demoLiveState(tick, now).broadcastId));
    expect(ids.size).toBe(1);
  });

  it("previews every alert-bearing event type, including the ones only the relay used to emit", () => {
    expect(demoEventTypes).toContain("membership-gift-received");
    expect(demoEventTypes).toContain("chat-moderation");
    expect(demoEventTypes).toContain("supersticker");
  });
});
