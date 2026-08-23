import { isRecord, type LiveState } from "@miciodev/shared-types";
import { getString } from "./youtube-normalize.js";

const youtubeApiBaseUrl = "https://www.googleapis.com/youtube/v3";

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

export interface ActiveBroadcast {
  videoId: string;
  liveChatId?: string;
  state: Omit<LiveState, "session">;
}

export async function fetchBroadcast(apiKey: string, videoId: string, signal?: AbortSignal): Promise<ActiveBroadcast | undefined> {
  const videoUrl = new URL(`${youtubeApiBaseUrl}/videos`);
  videoUrl.searchParams.set("part", "liveStreamingDetails");
  videoUrl.searchParams.set("id", videoId);
  videoUrl.searchParams.set("key", apiKey);
  const payload = await fetchYouTubePayload(videoUrl, signal);
  const item = Array.isArray(payload.items) && isRecord(payload.items[0]) ? payload.items[0] : undefined;
  const details = item && isRecord(item.liveStreamingDetails) ? item.liveStreamingDetails : undefined;
  if (!details) return undefined;
  const startedAt = getString(details, "actualStartTime");
  const endedAt = getString(details, "actualEndTime");
  const scheduledStartAt = getString(details, "scheduledStartTime");
  const viewers = getString(details, "concurrentViewers");
  const concurrentViewers = viewers && /^\d+$/.test(viewers) ? Number(viewers) : undefined;
  const status = endedAt ? "complete" : startedAt ? "live" : scheduledStartAt ? "upcoming" : "unknown";
  return {
    videoId,
    liveChatId: getString(details, "activeLiveChatId"),
    state: { broadcastId: videoId, status, startedAt, endedAt, scheduledStartAt, concurrentViewers },
  };
}
export async function discoverActiveBroadcast(
  apiKey: string,
  channelHandle: string,
  signal?: AbortSignal,
): Promise<ActiveBroadcast | undefined> {
  const handle = normalizeChannelHandle(channelHandle);
  if (!handle) return undefined;
  const channelUrl = new URL(`${youtubeApiBaseUrl}/channels`);
  channelUrl.searchParams.set("part", "id");
  channelUrl.searchParams.set("forHandle", handle);
  channelUrl.searchParams.set("key", apiKey);
  const channelPayload = await fetchYouTubePayload(channelUrl, signal);
  const channelItem = Array.isArray(channelPayload.items) && isRecord(channelPayload.items[0]) ? channelPayload.items[0] : undefined;
  const channelId = channelItem ? getString(channelItem, "id") : undefined;
  if (!channelId) return undefined;
  const searchUrl = new URL(`${youtubeApiBaseUrl}/search`);
  searchUrl.searchParams.set("part", "id");
  searchUrl.searchParams.set("channelId", channelId);
  searchUrl.searchParams.set("eventType", "live");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", "1");
  searchUrl.searchParams.set("key", apiKey);
  const searchPayload = await fetchYouTubePayload(searchUrl, signal);
  const searchItem = Array.isArray(searchPayload.items) && isRecord(searchPayload.items[0]) ? searchPayload.items[0] : undefined;
  const videoId = searchItem && isRecord(searchItem.id) ? getString(searchItem.id, "videoId") : undefined;
  return videoId ? fetchBroadcast(apiKey, videoId, signal) : undefined;
}

export interface ChannelStatistics {
  subscriberCount?: number;
}

/**
 * Subscriber counts are channel-level, not broadcast-level, and YouTube lets a channel
 * hide the number entirely (`hiddenSubscriberCount`) — that must surface as undefined,
 * never as a stale or fabricated figure.
 */
export async function fetchChannelStatistics(apiKey: string, channelHandle: string, signal?: AbortSignal): Promise<ChannelStatistics | undefined> {
  const handle = normalizeChannelHandle(channelHandle);
  if (!handle) return undefined;
  const channelUrl = new URL(`${youtubeApiBaseUrl}/channels`);
  channelUrl.searchParams.set("part", "statistics");
  channelUrl.searchParams.set("forHandle", handle);
  channelUrl.searchParams.set("key", apiKey);
  const payload = await fetchYouTubePayload(channelUrl, signal);
  const item = Array.isArray(payload.items) && isRecord(payload.items[0]) ? payload.items[0] : undefined;
  const statistics = item && isRecord(item.statistics) ? item.statistics : undefined;
  if (!statistics) return undefined;
  if (statistics.hiddenSubscriberCount === true) return { subscriberCount: undefined };
  const raw = getString(statistics, "subscriberCount");
  const subscriberCount = raw && /^\d+$/.test(raw) ? Number(raw) : undefined;
  return { subscriberCount };
}

export async function isEndedLiveChatResponse(response: Response): Promise<boolean> {
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

