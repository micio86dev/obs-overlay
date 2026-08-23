import { describe, expect, it } from "vitest";
import { formatLiveTime, mergeLiveState } from "./live-state";

describe("live state helpers", () => {
  it("derives elapsed duration locally and freezes it after completion", () => {
    expect(formatLiveTime({ status: "live", startedAt: "2026-08-23T10:00:00.000Z" }, Date.parse("2026-08-23T11:02:03.000Z"))).toBe("01:02:03");
    expect(formatLiveTime({ status: "complete", startedAt: "2026-08-23T10:00:00.000Z", endedAt: "2026-08-23T10:30:00.000Z" }, Date.parse("2026-08-23T11:02:03.000Z"))).toBe("00:30:00");
  });

  it("resets browser state when a relay snapshot names a different broadcast", () => {
    const oldState = { status: "live" as const, broadcastId: "one", peakViewers: 120, session: { chatMessages: 20, superChatCount: 1, superStickerCount: 0, newMembers: 0, giftedMemberships: 0, superChatRevenueMicros: {} } };
    const next = mergeLiveState(oldState, { status: "live", broadcastId: "two", concurrentViewers: 3, peakViewers: 3, session: { chatMessages: 0, superChatCount: 0, superStickerCount: 0, newMembers: 0, giftedMemberships: 0, superChatRevenueMicros: {} } });
    expect(next.broadcastId).toBe("two");
    expect(next.peakViewers).toBe(3);
  });

  it("treats an offline relay snapshot as authoritative instead of retaining stale metrics", () => {
    const live = { status: "live" as const, broadcastId: "one", concurrentViewers: 120, peakViewers: 120, session: { chatMessages: 20, superChatCount: 1, superStickerCount: 0, newMembers: 0, giftedMemberships: 0, superChatRevenueMicros: { EUR: 2_000_000 } } };
    const offline = { status: "offline" as const, session: { chatMessages: 0, superChatCount: 0, superStickerCount: 0, newMembers: 0, giftedMemberships: 0, superChatRevenueMicros: {} } };
    expect(mergeLiveState(live, offline)).toEqual(offline);
  });
});
