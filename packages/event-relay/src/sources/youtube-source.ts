import { isOverlayEvent, type OverlayEvent } from "@miciodev/shared-types";
import type { EventListener, EventSource } from "./mock-source.js";

const minimumPollIntervalMs = 1_000;
const maximumPollIntervalMs = 60_000;
const defaultFetchTimeoutMs = 15_000;
const initialDiscoveryRetryMs = 5 * 60_000;
const maximumDiscoveryRetryMs = 60 * 60_000;

type YouTubeMessage = {
  id: string;
  snippet: {
    type: "textMessageEvent" | "newSponsorEvent" | "superChatEvent";
    publishedAt: string;
    displayMessage?: string;
    superChatDetails?: { amountDisplayString?: string; currency?: string; userComment?: string };
  };
  authorDetails?: { displayName?: string; profileImageUrl?: string };
};

const youtubeApiBaseUrl = "https://www.googleapis.com/youtube/v3";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function fetchYouTubePayload(url: URL, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`YouTube API returned ${response.status}`);
  const payload: unknown = await response.json();
  if (!isRecord(payload)) throw new Error("YouTube API returned an invalid payload");
  return payload;
}

export function normalizeChannelHandle(handle: string | undefined): string | undefined {
  const normalized = handle?.trim().replace(/^@/, "");
  return normalized && normalized.length > 0 ? normalized : undefined;
}

/** Resolves a public channel handle to the active live broadcast's chat ID. */
export async function discoverActiveLiveChatId(
  apiKey: string,
  channelHandle: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  const handle = normalizeChannelHandle(channelHandle);
  if (!handle) return undefined;

  const channelUrl = new URL(`${youtubeApiBaseUrl}/channels`);
  channelUrl.searchParams.set("part", "id");
  channelUrl.searchParams.set("forHandle", handle);
  channelUrl.searchParams.set("key", apiKey);
  const channelPayload = await fetchYouTubePayload(channelUrl, signal);
  const channelItems = Array.isArray(channelPayload.items) ? channelPayload.items : [];
  const channelId = channelItems.length > 0 && isRecord(channelItems[0]) ? getString(channelItems[0], "id") : undefined;
  if (!channelId) return undefined;

  const searchUrl = new URL(`${youtubeApiBaseUrl}/search`);
  searchUrl.searchParams.set("part", "id");
  searchUrl.searchParams.set("channelId", channelId);
  searchUrl.searchParams.set("eventType", "live");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", "1");
  searchUrl.searchParams.set("key", apiKey);
  const searchPayload = await fetchYouTubePayload(searchUrl, signal);
  const searchItems = Array.isArray(searchPayload.items) ? searchPayload.items : [];
  const firstSearchItem = searchItems.length > 0 && isRecord(searchItems[0]) ? searchItems[0] : undefined;
  const videoId = firstSearchItem && isRecord(firstSearchItem.id) ? getString(firstSearchItem.id, "videoId") : undefined;
  if (!videoId) return undefined;

  const videoUrl = new URL(`${youtubeApiBaseUrl}/videos`);
  videoUrl.searchParams.set("part", "liveStreamingDetails");
  videoUrl.searchParams.set("id", videoId);
  videoUrl.searchParams.set("key", apiKey);
  const videoPayload = await fetchYouTubePayload(videoUrl, signal);
  const videoItems = Array.isArray(videoPayload.items) ? videoPayload.items : [];
  const firstVideoItem = videoItems.length > 0 && isRecord(videoItems[0]) ? videoItems[0] : undefined;
  return firstVideoItem && isRecord(firstVideoItem.liveStreamingDetails)
    ? getString(firstVideoItem.liveStreamingDetails, "activeLiveChatId")
    : undefined;
}

async function isEndedLiveChatResponse(response: Response): Promise<boolean> {
  if (response.status === 404) return true;
  if (response.status !== 403) return false;
  try {
    const payload: unknown = await response.clone().json();
    if (!isRecord(payload) || !isRecord(payload.error) || !Array.isArray(payload.error.errors)) return false;
    return payload.error.errors.some((error) => isRecord(error) && error.reason === "liveChatEnded");
  } catch {
    return false;
  }
}

function isYouTubeMessage(value: unknown): value is YouTubeMessage {
  if (!isRecord(value) || typeof value.id !== "string" || !isRecord(value.snippet)) return false;
  if (value.authorDetails !== undefined && (!isRecord(value.authorDetails)
    || !hasOptionalString(value.authorDetails.displayName)
    || !hasOptionalString(value.authorDetails.profileImageUrl))) return false;
  const { snippet } = value;
  if ((snippet.type !== "textMessageEvent" && snippet.type !== "newSponsorEvent" && snippet.type !== "superChatEvent")
    || typeof snippet.publishedAt !== "string"
    || !hasOptionalString(snippet.displayMessage)) return false;

  if (snippet.type !== "superChatEvent") return snippet.superChatDetails === undefined || (
    isRecord(snippet.superChatDetails)
    && hasOptionalString(snippet.superChatDetails.amountDisplayString)
    && hasOptionalString(snippet.superChatDetails.currency)
    && hasOptionalString(snippet.superChatDetails.userComment)
  );
  if (!isRecord(snippet.superChatDetails)) return false;
  return hasOptionalString(snippet.superChatDetails.amountDisplayString)
    && hasOptionalString(snippet.superChatDetails.currency)
    && hasOptionalString(snippet.superChatDetails.userComment);
}

export function clampPollInterval(value: number, fallback = 10_000): number {
  const safeFallback = Number.isFinite(fallback) ? fallback : 10_000;
  const candidate = Number.isFinite(value) ? value : safeFallback;
  return Math.min(Math.max(candidate, minimumPollIntervalMs), maximumPollIntervalMs);
}

export class YouTubeSource implements EventSource {
  private listeners = new Set<EventListener>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private seenMessageIds = new Set<string>();
  private running = false;
  private generation = 0;
  private abortController: AbortController | undefined;
  private requestTimeoutTimer: ReturnType<typeof setTimeout> | undefined;
  private nextPageToken: string | undefined;
  private discoveryRetryAttempt = 0;
  private readonly pollIntervalMs: number;
  private readonly fetchTimeoutMs: number;

  public constructor(
    private readonly apiKey: string,
  liveChatId: string | undefined,
    intervalMs = 10_000,
    fetchTimeoutMs = defaultFetchTimeoutMs,
    channelHandle?: string,
  ) {
    this.liveChatId = liveChatId;
    this.channelHandle = normalizeChannelHandle(channelHandle);
    this.pollIntervalMs = clampPollInterval(intervalMs);
    this.fetchTimeoutMs = clampPollInterval(fetchTimeoutMs, defaultFetchTimeoutMs);
  }

  private liveChatId: string | undefined;
  private readonly channelHandle: string | undefined;

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.generation += 1;
    this.nextPageToken = undefined;
    this.discoveryRetryAttempt = 0;
    void this.poll(this.generation);
  }

  public stop(): void {
    if (!this.running) return;
    this.running = false;
    this.generation += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.requestTimeoutTimer) clearTimeout(this.requestTimeoutTimer);
    this.requestTimeoutTimer = undefined;
    this.abortController?.abort();
    this.abortController = undefined;
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
        const liveChatId = await discoverActiveLiveChatId(this.apiKey, this.channelHandle, abortController.signal);
        if (!this.isActive(generation)) return;
        if (!liveChatId) {
          console.info(`No active YouTube live found for @${this.channelHandle}; retrying`);
          this.scheduleDiscovery(generation);
          return;
        }
        this.liveChatId = liveChatId;
        this.nextPageToken = undefined;
        this.discoveryRetryAttempt = 0;
      }
      const url = new URL("https://www.googleapis.com/youtube/v3/liveChat/messages");
      url.searchParams.set("liveChatId", this.liveChatId);
      url.searchParams.set("part", "id,snippet,authorDetails");
      url.searchParams.set("maxResults", "200");
      url.searchParams.set("key", this.apiKey);
      if (this.nextPageToken) url.searchParams.set("pageToken", this.nextPageToken);
      const response = await fetch(url, { signal: abortController.signal });
      if (this.channelHandle && await isEndedLiveChatResponse(response)) {
        console.info("YouTube live chat ended; looking for the next active live");
        this.liveChatId = undefined;
        this.nextPageToken = undefined;
        this.scheduleDiscovery(generation);
        return;
      }
      if (!response.ok) throw new Error(`YouTube API returned ${response.status}`);
      const payload: unknown = await response.json();
      if (!isRecord(payload)) throw new Error("YouTube API returned an invalid payload");
      if (!this.isActive(generation)) return;
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
      const pollingIntervalMillis = payload.pollingIntervalMillis;
      const delay = typeof pollingIntervalMillis === "number" ? pollingIntervalMillis : this.pollIntervalMs;
      this.schedule(delay, generation);
    } catch (error) {
      if (!this.isActive(generation) || (abortController.signal.aborted && !didTimeout)) return;
      console.error("YouTube polling failed; retrying", error);
      if (resolvingLiveChat) this.scheduleDiscovery(generation);
      else this.schedule(this.pollIntervalMs, generation);
    } finally {
      clearTimeout(requestTimeoutTimer);
      if (this.requestTimeoutTimer === requestTimeoutTimer) this.requestTimeoutTimer = undefined;
      if (this.abortController === abortController) this.abortController = undefined;
    }
  }

  private schedule(delay: number, generation: number, clampDelay = true): void {
    if (!this.isActive(generation)) return;
    const scheduledDelay = clampDelay ? clampPollInterval(delay, this.pollIntervalMs) : delay;
    this.timer = setTimeout(() => void this.poll(generation), scheduledDelay);
  }

  private scheduleDiscovery(generation: number): void {
    const delay = Math.min(
      initialDiscoveryRetryMs * (2 ** this.discoveryRetryAttempt),
      maximumDiscoveryRetryMs,
    );
    this.discoveryRetryAttempt = Math.min(this.discoveryRetryAttempt + 1, 4);
    this.schedule(delay, generation, false);
  }

  private publish(event: OverlayEvent | undefined): void {
    if (!event || !isOverlayEvent(event) || this.seenMessageIds.has(event.id)) return;
    this.seenMessageIds.add(event.id);
    if (this.seenMessageIds.size > 5_000) this.seenMessageIds.delete(this.seenMessageIds.values().next().value as string);
    this.listeners.forEach((listener) => listener(event));
  }

  private normalize(message: YouTubeMessage): OverlayEvent | undefined {
    const base = {
      id: message.id,
      occurredAt: message.snippet.publishedAt,
      author: message.authorDetails?.displayName ?? "YouTube viewer",
      avatarUrl: message.authorDetails?.profileImageUrl
    };
    if (message.snippet.type === "textMessageEvent") return { ...base, type: "chat", message: message.snippet.displayMessage ?? "" };
    if (message.snippet.type === "newSponsorEvent") return { ...base, type: "subscriber", message: "Joined the channel" };
    if (message.snippet.type === "superChatEvent" && message.snippet.superChatDetails) return {
      ...base, type: "superchat", amount: message.snippet.superChatDetails?.amountDisplayString ?? "Support",
      currency: message.snippet.superChatDetails?.currency ?? "", message: message.snippet.superChatDetails?.userComment ?? ""
    };
    return undefined;
  }
}
