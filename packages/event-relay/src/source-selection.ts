import { MockSource, type EventListener, type EventSource } from "./sources/mock-source.js";
import { normalizeChannelHandle, YouTubeSource } from "./sources/youtube-source.js";

export interface SourceSelectionOptions {
  sourceName?: string;
  mockSourceEnabled?: string;
  mockIntervalMs: number;
  youtubeApiKey?: string;
  youtubeLiveChatId?: string;
  youtubeChannelHandle?: string;
  pollIntervalMs: number;
}

/** A healthy relay source that deliberately produces no overlay events. */
export class IdleSource implements EventSource {
  public subscribe(_listener: EventListener): () => void {
    void _listener;
    return () => undefined;
  }

  public start(): void {}

  public stop(): void {}
}

export function createEventSource(options: SourceSelectionOptions): EventSource {
  const sourceName = options.sourceName ?? "none";
  if (sourceName === "none") return new IdleSource();
  if (sourceName === "mock") {
    if (options.mockSourceEnabled !== "true") {
      throw new Error("EVENT_SOURCE=mock requires MOCK_SOURCE_ENABLED=true to emit synthetic events");
    }
    return new MockSource(options.mockIntervalMs);
  }
  if (sourceName === "youtube") {
    const channelHandle = normalizeChannelHandle(options.youtubeChannelHandle);
    if (!options.youtubeApiKey || (!options.youtubeLiveChatId && !channelHandle)) {
      throw new Error("YOUTUBE_API_KEY and either YOUTUBE_CHANNEL_HANDLE or YOUTUBE_LIVE_CHAT_ID are required for EVENT_SOURCE=youtube");
    }
    return new YouTubeSource(
      options.youtubeApiKey,
      options.youtubeLiveChatId,
      options.pollIntervalMs,
      undefined,
      options.youtubeLiveChatId ? undefined : channelHandle,
    );
  }
  throw new Error(`Unsupported EVENT_SOURCE: ${sourceName}. Use none, mock, or youtube.`);
}
