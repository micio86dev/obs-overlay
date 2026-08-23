import { createEmptySessionMetrics, recordSessionMetrics, type LiveState, type OverlayEvent } from "@miciodev/shared-types";

/** Relay-owned state so multiple OBS sources never multiply YouTube requests. */
export class LiveSessionTracker {
  private state: LiveState = { status: "unknown", session: createEmptySessionMetrics() };

  public get snapshot(): LiveState {
    return {
      ...this.state,
      session: {
        ...this.state.session,
        superChatRevenueMicros: { ...this.state.session.superChatRevenueMicros },
      },
    };
  }

  public update(next: Omit<LiveState, "session" | "peakViewers">): void {
    if (next.status === "offline") {
      this.state = { status: "offline", session: createEmptySessionMetrics() };
      return;
    }
    const isNewBroadcast = next.broadcastId !== undefined && next.broadcastId !== this.state.broadcastId;
    const session = isNewBroadcast ? createEmptySessionMetrics() : this.state.session;
    const previousPeak = isNewBroadcast ? 0 : this.state.peakViewers ?? 0;
    const peakViewers = next.concurrentViewers === undefined
      ? (isNewBroadcast ? undefined : this.state.peakViewers)
      : Math.max(previousPeak, next.concurrentViewers);
    this.state = {
      ...this.state,
      ...next,
      session,
      ...(peakViewers === undefined ? {} : { peakViewers }),
    };
  }

  public record(event: OverlayEvent): void {
    this.state = { ...this.state, session: recordSessionMetrics(this.state.session, event) };
  }

  /** Subscriber count is a channel-level stat polled independently of any broadcast's lifecycle. */
  public updateChannelStatistics(subscriberCount: number | undefined): void {
    this.state = { ...this.state, subscriberCount };
  }
}
