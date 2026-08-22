import type { OverlayEvent } from "@miciodev/shared-types";
import type { EventListener, EventSource } from "./mock-source.js";

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

export class YouTubeSource implements EventSource {
  private listeners = new Set<EventListener>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private seenMessageIds = new Set<string>();

  public constructor(
    private readonly apiKey: string,
    private readonly liveChatId: string,
    private readonly intervalMs = 10_000,
  ) {}

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public start(): void {
    void this.poll();
  }

  public stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private async poll(): Promise<void> {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/liveChat/messages");
      url.searchParams.set("liveChatId", this.liveChatId);
      url.searchParams.set("part", "id,snippet,authorDetails");
      url.searchParams.set("maxResults", "200");
      url.searchParams.set("key", this.apiKey);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`YouTube API returned ${response.status}`);
      const payload = await response.json() as { items?: YouTubeMessage[]; pollingIntervalMillis?: number };
      payload.items?.forEach((message) => this.publish(this.normalize(message)));
      this.schedule(payload.pollingIntervalMillis ?? this.intervalMs);
    } catch (error) {
      console.error("YouTube polling failed; retrying", error);
      this.schedule(this.intervalMs);
    }
  }

  private schedule(delay: number): void {
    this.timer = setTimeout(() => void this.poll(), Math.max(delay, this.intervalMs));
  }

  private publish(event: OverlayEvent | undefined): void {
    if (!event || this.seenMessageIds.has(event.id)) return;
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
    if (message.snippet.type === "superChatEvent") return {
      ...base, type: "superchat", amount: message.snippet.superChatDetails?.amountDisplayString ?? "Support",
      currency: message.snippet.superChatDetails?.currency ?? "", message: message.snippet.superChatDetails?.userComment ?? ""
    };
    return undefined;
  }
}
