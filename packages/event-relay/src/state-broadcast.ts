import type { LiveState } from "@miciodev/shared-types";

export interface CoalescerClock {
  now: () => number;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
}

const systemClock: CoalescerClock = { now: Date.now, setTimeout, clearTimeout };

/**
 * A busy chat would otherwise push a full state snapshot per message. Metric drift is
 * rate limited to one frame per window; lifecycle changes still reach OBS instantly.
 */
export class StateBroadcastCoalescer {
  private lastPublishedAt: number | undefined;
  private lastStatus: LiveState["status"] | undefined;
  private lastBroadcastId: string | undefined;
  private pending: LiveState | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;

  public constructor(
    private readonly publish: (state: LiveState) => void,
    private readonly windowMs = 1_000,
    private readonly clock: CoalescerClock = systemClock,
  ) {
    if (!Number.isFinite(windowMs) || windowMs < 0) throw new Error("windowMs must be a non-negative number");
  }

  public push(state: LiveState): void {
    const isLifecycleChange = state.status !== this.lastStatus || state.broadcastId !== this.lastBroadcastId;
    if (isLifecycleChange || this.lastPublishedAt === undefined || this.clock.now() - this.lastPublishedAt >= this.windowMs) {
      this.emit(state);
      return;
    }
    this.pending = state;
    if (this.timer !== undefined) return;
    const delay = this.windowMs - (this.clock.now() - this.lastPublishedAt);
    this.timer = this.clock.setTimeout(() => {
      this.timer = undefined;
      const pending = this.pending;
      this.pending = undefined;
      if (pending) this.emit(pending);
    }, delay);
  }

  private emit(state: LiveState): void {
    if (this.timer !== undefined) { this.clock.clearTimeout(this.timer); this.timer = undefined; }
    this.pending = undefined;
    this.lastPublishedAt = this.clock.now();
    this.lastStatus = state.status;
    this.lastBroadcastId = state.broadcastId;
    this.publish(state);
  }

  public dispose(): void {
    if (this.timer !== undefined) this.clock.clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = undefined;
  }
}
