import type { LiveState } from "@miciodev/shared-types";

const tickMs = 5_500;
const upcomingTicks = 3;
const completeTick = 36;
const demoBroadcastId = "demo-broadcast";

/**
 * A scripted broadcast lifecycle for the browser-only demo. It never contacts YouTube and
 * exists so the shared status bar can be reviewed in OBS without credentials.
 */
export function demoLiveState(tick: number, now: number): Omit<LiveState, "session"> {
  if (tick < upcomingTicks) {
    return { broadcastId: demoBroadcastId, status: "upcoming", scheduledStartAt: new Date(now + (upcomingTicks - tick) * tickMs).toISOString() };
  }
  const startedAt = new Date(now - (tick - upcomingTicks) * tickMs).toISOString();
  if (tick >= completeTick) {
    return { broadcastId: demoBroadcastId, status: "complete", startedAt, endedAt: new Date(now).toISOString() };
  }
  return {
    broadcastId: demoBroadcastId,
    status: "live",
    startedAt,
    concurrentViewers: 42 + (tick - upcomingTicks) * 9,
    subscriberCount: 1_180 + tick * 3,
    streamHealth: tick % 12 === 0 ? "warning" : "good",
  };
}
