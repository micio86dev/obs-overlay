import { isOverlayEvent, isRecord, type LiveState, type OverlayEvent } from "@miciodev/shared-types";
import type { EventListener, EventSource } from "./mock-source.js";
import { Backoff } from "../backoff.js";
import { QuotaBudget, quotaUnits, type QuotaPressure } from "../quota-budget.js";
import { BroadcastMetricsPoller } from "./broadcast-metrics.js";
import { RecentIds } from "../recent-ids.js";
import { discoverActiveBroadcast, isEndedLiveChatResponse, normalizeChannelHandle } from "./youtube-discovery.js";
import { isYouTubeMessage, normalizeYouTubeMessage, type YouTubeMessage } from "./youtube-normalize.js";

const minimumPollIntervalMs = 1_000;
const maximumPollIntervalMs = 60_000;
const defaultFetchTimeoutMs = 15_000;
const initialDiscoveryRetryMs = 5 * 60_000;
const maximumDiscoveryRetryMs = 60 * 60_000;
const maximumChatRetryMs = 5 * 60_000;
const degradedChatPollMs = 60_000;

export function clampPollInterval(value: number, fallback = 10_000): number {
  const safeFallback = Number.isFinite(fallback) ? fallback : 10_000;
  const candidate = Number.isFinite(value) ? value : safeFallback;
  return Math.min(Math.max(candidate, minimumPollIntervalMs), maximumPollIntervalMs);
}

export class YouTubeSource implements EventSource {
  private listeners = new Set<EventListener>();
  private stateListeners = new Set<(state: Omit<LiveState, "session">) => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly seenMessageIds = new RecentIds();
  private running = false;
  private generation = 0;
  private abortController: AbortController | undefined;
  private requestTimeoutTimer: ReturnType<typeof setTimeout> | undefined;
  private nextPageToken: string | undefined;
  private readonly discoveryBackoff = new Backoff(initialDiscoveryRetryMs, maximumDiscoveryRetryMs, 4);
  private readonly chatBackoff: Backoff;
  private lastPressure: QuotaPressure = "normal";
  private liveChatId: string | undefined;
  private videoId: string | undefined;
  private readonly channelHandle: string | undefined;
  private readonly pollIntervalMs: number;
  private readonly fetchTimeoutMs: number;
  private readonly metrics: BroadcastMetricsPoller;

  public constructor(
    private readonly apiKey: string,
    liveChatId: string | undefined,
    intervalMs = 10_000,
    fetchTimeoutMs = defaultFetchTimeoutMs,
    channelHandle?: string,
    private readonly budget = new QuotaBudget(0),
  ) {
    this.liveChatId = liveChatId;
    this.channelHandle = normalizeChannelHandle(channelHandle);
    this.pollIntervalMs = clampPollInterval(intervalMs);
    this.chatBackoff = new Backoff(this.pollIntervalMs, maximumChatRetryMs, 5);
    this.fetchTimeoutMs = clampPollInterval(fetchTimeoutMs, defaultFetchTimeoutMs);
    this.metrics = new BroadcastMetricsPoller({
      apiKey: this.apiKey,
      budget: this.budget,
      reportPressure: () => this.reportPressure(),
      onState: (state) => this.publishState(state),
      onComplete: () => this.onBroadcastComplete(),
    });
  }

  /** Announces a quota pressure change once, not on every poll. */
  private reportPressure(): QuotaPressure {
    const pressure = this.budget.pressure;
    if (pressure !== this.lastPressure) {
      this.lastPressure = pressure;
      if (pressure === "degraded") {
        console.warn(`YouTube quota above ${this.budget.spent} units; slowing polling to protect the daily allowance`);
      }
      if (pressure === "exhausted") {
        const minutes = Math.round(this.budget.millisecondsUntilReset() / 60_000);
        console.warn(`YouTube daily quota exhausted; pausing until it resets in ${minutes} minutes`);
      }
      if (pressure === "normal") console.info("YouTube quota available again; resuming normal polling");
    }
    return pressure;
  }

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public subscribeState(listener: (state: Omit<LiveState, "session">) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.generation += 1;
    this.nextPageToken = undefined;
    this.discoveryBackoff.reset();
    this.chatBackoff.reset();
    this.metrics.stop();
    void this.poll(this.generation);
  }

  public stop(): void {
    if (!this.running) return;
    this.running = false;
    this.generation += 1;
    this.cancelChatWork();
    this.metrics.stop();
  }

  private isActive(generation: number): boolean {
    return this.running && this.generation === generation;
  }

  private async poll(generation: number): Promise<void> {
    if (!this.isActive(generation)) return;
    const abortController = new AbortController();
    this.abortController = abortController;
    let didTimeout = false;
    const requestTimeoutTimer = setTimeout(() => {
      didTimeout = true;
      abortController.abort();
    }, this.fetchTimeoutMs);
    this.requestTimeoutTimer = requestTimeoutTimer;
    let resolvingLiveChat = false;
    try {
      if (!this.liveChatId) {
        if (!this.channelHandle) throw new Error("A YouTube live chat ID or channel handle is required");
        resolvingLiveChat = true;
        // channels.list + search.list + videos.list; search alone is 100 of these units.
        const discoveryUnits = quotaUnits.channels + quotaUnits.search + quotaUnits.videos;
        if (this.parkOnExhaustedQuota(generation, discoveryUnits)) return;
        this.budget.spend(discoveryUnits);
        const broadcast = await discoverActiveBroadcast(this.apiKey, this.channelHandle, abortController.signal);
        if (!this.isActive(generation)) return;
        if (!broadcast?.liveChatId) {
          console.info(`No active YouTube live found for @${this.channelHandle}; retrying`);
          this.scheduleDiscovery(generation);
          return;
        }
        this.liveChatId = broadcast.liveChatId;
        this.videoId = broadcast.videoId;
        this.publishState(broadcast.state);
        this.metrics.start(broadcast.videoId);
        this.nextPageToken = undefined;
        this.discoveryBackoff.reset();
      }
      const url = new URL("https://www.googleapis.com/youtube/v3/liveChat/messages");
      url.searchParams.set("liveChatId", this.liveChatId);
      url.searchParams.set("part", "id,snippet,authorDetails");
      url.searchParams.set("maxResults", "200");
      url.searchParams.set("key", this.apiKey);
      if (this.nextPageToken) url.searchParams.set("pageToken", this.nextPageToken);
      // liveChatMessages.list is the dominant quota cost of a live session.
      if (this.parkOnExhaustedQuota(generation, quotaUnits.liveChatMessages)) return;
      this.budget.spend(quotaUnits.liveChatMessages);
      const response = await fetch(url, { signal: abortController.signal });
      if (!this.isActive(generation) || abortController.signal.aborted) return;
      if (this.channelHandle && await isEndedLiveChatResponse(response)) {
        console.info("YouTube live chat ended; looking for the next active live");
        this.liveChatId = undefined;
        this.videoId = undefined;
        this.nextPageToken = undefined;
        this.metrics.stop();
        this.publishState({ status: "offline" });
        this.scheduleDiscovery(generation);
        return;
      }
      if (!response.ok) throw new Error(`YouTube API returned ${response.status}`);
      const payload: unknown = await response.json();
      if (!isRecord(payload)) throw new Error("YouTube API returned an invalid payload");
      if (!this.isActive(generation)) return;
      this.chatBackoff.reset();
      this.nextPageToken = typeof payload.nextPageToken === "string" && payload.nextPageToken.length > 0
        ? payload.nextPageToken
        : undefined;
      const items = Array.isArray(payload.items) ? payload.items : [];
      for (const item of items) {
        if (!isYouTubeMessage(item)) {
          console.warn("Ignoring malformed YouTube live-chat item");
          continue;
        }
        try {
          this.publish(this.normalize(item));
        } catch (error) {
          console.warn("Ignoring unnormalizable YouTube live-chat item", error);
        }
      }
      // Never poll faster than the configured floor, whatever the API suggests.
      const pollingIntervalMillis = payload.pollingIntervalMillis;
      const suggested = typeof pollingIntervalMillis === "number" ? pollingIntervalMillis : this.pollIntervalMs;
      const floor = this.reportPressure() === "degraded" ? degradedChatPollMs : this.pollIntervalMs;
      this.schedule(Math.max(suggested, floor), generation, false);
    } catch (error) {
      if (!this.isActive(generation) || (abortController.signal.aborted && !didTimeout)) return;
      console.error("YouTube polling failed; retrying", error);
      if (resolvingLiveChat) this.scheduleDiscovery(generation);
      else if (this.isQuotaOrRateError(error)) this.scheduleChatBackoff(generation);
      else this.schedule(this.pollIntervalMs, generation);
    } finally {
      clearTimeout(requestTimeoutTimer);
      if (this.requestTimeoutTimer === requestTimeoutTimer) this.requestTimeoutTimer = undefined;
      if (this.abortController === abortController) this.abortController = undefined;
    }
  }

  /** Holds the last known state and waits for the UTC reset rather than burning a 403. */
  private parkOnExhaustedQuota(generation: number, units: number): boolean {
    if (this.budget.canSpend(units)) return false;
    this.reportPressure();
    this.schedule(this.budget.millisecondsUntilReset(), generation, false);
    return true;
  }

  private schedule(delay: number, generation: number, clampDelay = true): void {
    if (!this.isActive(generation)) return;
    if (this.timer) clearTimeout(this.timer);
    const scheduledDelay = clampDelay ? clampPollInterval(delay, this.pollIntervalMs) : delay;
    this.timer = setTimeout(() => void this.poll(generation), scheduledDelay);
  }

  private scheduleDiscovery(generation: number): void {
    this.schedule(this.discoveryBackoff.next(), generation, false);
  }

  private scheduleChatBackoff(generation: number): void {
    this.schedule(this.chatBackoff.next(), generation, false);
  }

  private isQuotaOrRateError(error: unknown): boolean {
    return error instanceof Error && /YouTube API returned (403|429)/.test(error.message);
  }

  private cancelChatWork(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.requestTimeoutTimer) clearTimeout(this.requestTimeoutTimer);
    this.requestTimeoutTimer = undefined;
    this.abortController?.abort();
    this.abortController = undefined;
  }

  /** The broadcast finished: drop the chat cursor and go back to looking for the next one. */
  private onBroadcastComplete(): void {
    const generation = this.generation;
    this.cancelChatWork();
    this.liveChatId = undefined;
    this.videoId = undefined;
    this.nextPageToken = undefined;
    this.metrics.stop();
    this.scheduleDiscovery(generation);
  }

  private publishState(state: Omit<LiveState, "session">): void {
    this.stateListeners.forEach((listener) => listener(state));
  }

  private publish(event: OverlayEvent | undefined): void {
    if (!event || !isOverlayEvent(event) || this.seenMessageIds.has(event.id)) return;
    this.seenMessageIds.add(event.id);
    this.listeners.forEach((listener) => listener(event));
  }

  private normalize(message: YouTubeMessage): OverlayEvent | undefined {
    return normalizeYouTubeMessage(message);
  }
}
