import { Backoff } from "../backoff.js";
import { QuotaBudget, quotaUnits, type QuotaPressure } from "../quota-budget.js";
import { fetchChannelStatistics } from "./youtube-discovery.js";

const statisticsRefreshMs = 5 * 60_000;
const maximumStatisticsRetryMs = 60 * 60_000;
const degradedStatisticsRefreshMs = 30 * 60_000;

export interface ChannelStatisticsPollerOptions {
  apiKey: string;
  channelHandle: string;
  budget: QuotaBudget;
  /** Shared with the other pollers so a pressure change is announced once, not three times. */
  reportPressure: () => QuotaPressure;
  onSubscriberCount: (subscriberCount: number | undefined) => void;
}

/**
 * Subscriber count is a channel-level stat, independent of any one broadcast's lifecycle,
 * so it runs on its own generation and never needs a videoId to keep polling.
 */
export class ChannelStatisticsPoller {
  private generation = 0;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private abortController: AbortController | undefined;
  private readonly backoff = new Backoff(statisticsRefreshMs, maximumStatisticsRetryMs, 4);

  public constructor(private readonly options: ChannelStatisticsPollerOptions) {}

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.generation += 1;
    this.backoff.reset();
    this.schedule(this.generation, 0);
  }

  public stop(): void {
    this.running = false;
    this.generation += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.abortController?.abort();
    this.abortController = undefined;
    this.backoff.reset();
  }

  private isActive(generation: number): boolean {
    return this.running && this.generation === generation;
  }

  private schedule(generation: number, delay: number): void {
    if (!this.isActive(generation)) return;
    this.timer = setTimeout(() => void this.refresh(generation), delay);
  }

  private async refresh(generation: number): Promise<void> {
    if (!this.isActive(generation)) return;
    const abortController = new AbortController();
    this.abortController = abortController;
    try {
      if (!this.options.budget.canSpend(quotaUnits.channels)) {
        this.options.reportPressure();
        this.schedule(generation, this.options.budget.millisecondsUntilReset());
        return;
      }
      this.options.budget.spend(quotaUnits.channels); // channels.list, 1 unit per refresh.
      const statistics = await fetchChannelStatistics(this.options.apiKey, this.options.channelHandle, abortController.signal);
      if (!this.isActive(generation)) return;
      this.options.onSubscriberCount(statistics?.subscriberCount);
      this.backoff.reset();
      const refreshMs = this.options.reportPressure() === "degraded" ? degradedStatisticsRefreshMs : statisticsRefreshMs;
      this.schedule(generation, refreshMs);
    } catch (error) {
      if (!this.isActive(generation) || abortController.signal.aborted) return;
      console.warn("YouTube channel statistics refresh failed; retaining last snapshot", error);
      this.schedule(generation, this.backoff.next());
    } finally {
      if (this.abortController === abortController) this.abortController = undefined;
    }
  }
}
