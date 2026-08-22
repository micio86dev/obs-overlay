import { isOverlayEvent, type OverlayEvent } from "@miciodev/shared-types";
import type { EventListener, EventSource } from "./mock-source.js";

const minimumPollIntervalMs = 1_000;
const maximumPollIntervalMs = 60_000;
const defaultFetchTimeoutMs = 15_000;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
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
  private readonly pollIntervalMs: number;
  private readonly fetchTimeoutMs: number;

  public constructor(
    private readonly apiKey: string,
    private readonly liveChatId: string,
    intervalMs = 10_000,
    fetchTimeoutMs = defaultFetchTimeoutMs,
  ) {
    this.pollIntervalMs = clampPollInterval(intervalMs);
    this.fetchTimeoutMs = clampPollInterval(fetchTimeoutMs, defaultFetchTimeoutMs);
  }

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.generation += 1;
    this.nextPageToken = undefined;
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
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/liveChat/messages");
      url.searchParams.set("liveChatId", this.liveChatId);
      url.searchParams.set("part", "id,snippet,authorDetails");
      url.searchParams.set("maxResults", "200");
      url.searchParams.set("key", this.apiKey);
      if (this.nextPageToken) url.searchParams.set("pageToken", this.nextPageToken);
      const response = await fetch(url, { signal: abortController.signal });
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
      this.schedule(this.pollIntervalMs, generation);
    } finally {
      clearTimeout(requestTimeoutTimer);
      if (this.requestTimeoutTimer === requestTimeoutTimer) this.requestTimeoutTimer = undefined;
      if (this.abortController === abortController) this.abortController = undefined;
    }
  }

  private schedule(delay: number, generation: number): void {
    if (!this.isActive(generation)) return;
    this.timer = setTimeout(() => void this.poll(generation), clampPollInterval(delay, this.pollIntervalMs));
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
