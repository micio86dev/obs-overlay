import type { LiveState } from "@miciodev/shared-types";
import { Backoff } from "../backoff.js";
import { QuotaBudget, quotaUnits, type QuotaPressure } from "../quota-budget.js";
import { fetchBroadcast } from "./youtube-discovery.js";

const metricsRefreshMs = 20_000;
const maximumMetricsRetryMs = 5 * 60_000;
const degradedMetricsRefreshMs = 5 * 60_000;

export interface BroadcastMetricsOptions {
  apiKey: string;
  budget: QuotaBudget;
  /** Shared with the chat loop so a pressure change is announced once, not twice. */
  reportPressure: () => QuotaPressure;
  onState: (state: Omit<LiveState, "session">) => void;
  onComplete: () => void;
}

/**
 * Refreshes viewer counts and lifecycle for one broadcast. It owns its own timer,
 * abort controller and generation so the chat loop never has to synchronise with it.
 */
export class BroadcastMetricsPoller {
  private generation = 0;
  private videoId: string | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private abortController: AbortController | undefined;
  private readonly backoff = new Backoff(metricsRefreshMs, maximumMetricsRetryMs, 4);

  public constructor(private readonly options: BroadcastMetricsOptions) {}

  public start(videoId: string): void {
    this.stop();
    this.videoId = videoId;
    this.backoff.reset();
    this.schedule(this.generation, videoId, metricsRefreshMs);
  }

  public stop(): void {
    this.generation += 1;
    this.videoId = undefined;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.abortController?.abort();
    this.abortController = undefined;
    this.backoff.reset();
  }

  private isActive(generation: number, videoId: string): boolean {
    return this.generation === generation && this.videoId === videoId;
  }

  private schedule(generation: number, videoId: string, delay: number): void {
    if (!this.isActive(generation, videoId)) return;
    this.timer = setTimeout(() => void this.refresh(generation, videoId), delay);
  }

  private async refresh(generation: number, videoId: string): Promise<void> {
    if (!this.isActive(generation, videoId)) return;
    const abortController = new AbortController();
    this.abortController = abortController;
    try {
      if (!this.options.budget.canSpend(quotaUnits.videos)) {
        this.options.reportPressure();
        this.schedule(generation, videoId, this.options.budget.millisecondsUntilReset());
        return;
      }
      this.options.budget.spend(quotaUnits.videos); // videos.list, 1 unit per refresh.
      const broadcast = await fetchBroadcast(this.options.apiKey, videoId, abortController.signal);
      if (!broadcast) throw new Error("YouTube metrics response omitted the active broadcast");
      if (!this.isActive(generation, videoId)) return;
      this.options.onState(broadcast.state);
      if (broadcast.state.status === "complete") {
        this.options.onComplete();
        return;
      }
      this.backoff.reset();
      const refreshMs = this.options.reportPressure() === "degraded" ? degradedMetricsRefreshMs : metricsRefreshMs;
      this.schedule(generation, videoId, refreshMs);
    } catch (error) {
      if (!this.isActive(generation, videoId) || abortController.signal.aborted) return;
      console.warn("YouTube live metrics refresh failed; retaining last snapshot", error);
      this.schedule(generation, videoId, this.backoff.next());
    } finally {
      if (this.abortController === abortController) this.abortController = undefined;
    }
  }
}
