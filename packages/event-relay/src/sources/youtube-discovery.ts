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

const maximumRecentUploadsChecked = 10;

/** videos.list always returns the id, so a batched lookup still knows which broadcast it read. */
function toActiveBroadcast(item: Record<string, unknown>, fallbackVideoId?: string): ActiveBroadcast | undefined {
  const details = isRecord(item.liveStreamingDetails) ? item.liveStreamingDetails : undefined;
  if (!details) return undefined;
  const videoId = getString(item, "id") ?? fallbackVideoId;
  if (!videoId) return undefined;
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

/** One videos.list call covers every candidate: the cost is per request, not per id. */
async function fetchVideoItems(apiKey: string, videoIds: string[], signal?: AbortSignal): Promise<Record<string, unknown>[]> {
  const videoUrl = new URL(`${youtubeApiBaseUrl}/videos`);
  videoUrl.searchParams.set("part", "liveStreamingDetails");
  videoUrl.searchParams.set("id", videoIds.join(","));
  videoUrl.searchParams.set("key", apiKey);
  const payload = await fetchYouTubePayload(videoUrl, signal);
  return Array.isArray(payload.items) ? payload.items.filter(isRecord) : [];
}

export async function fetchBroadcast(apiKey: string, videoId: string, signal?: AbortSignal): Promise<ActiveBroadcast | undefined> {
  const [item] = await fetchVideoItems(apiKey, [videoId], signal);
  return item ? toActiveBroadcast(item, videoId) : undefined;
}

async function fetchUploadsPlaylistId(apiKey: string, handle: string, signal?: AbortSignal): Promise<string | undefined> {
  const channelUrl = new URL(`${youtubeApiBaseUrl}/channels`);
  channelUrl.searchParams.set("part", "contentDetails");
  channelUrl.searchParams.set("forHandle", handle);
  channelUrl.searchParams.set("key", apiKey);
  const payload = await fetchYouTubePayload(channelUrl, signal);
  const item = Array.isArray(payload.items) && isRecord(payload.items[0]) ? payload.items[0] : undefined;
  const contentDetails = item && isRecord(item.contentDetails) ? item.contentDetails : undefined;
  const relatedPlaylists = contentDetails && isRecord(contentDetails.relatedPlaylists) ? contentDetails.relatedPlaylists : undefined;
  return relatedPlaylists ? getString(relatedPlaylists, "uploads") : undefined;
}

async function fetchRecentUploadIds(apiKey: string, playlistId: string, signal?: AbortSignal): Promise<string[]> {
  const playlistUrl = new URL(`${youtubeApiBaseUrl}/playlistItems`);
  playlistUrl.searchParams.set("part", "contentDetails");
  playlistUrl.searchParams.set("playlistId", playlistId);
  playlistUrl.searchParams.set("maxResults", String(maximumRecentUploadsChecked));
  playlistUrl.searchParams.set("key", apiKey);
  const payload = await fetchYouTubePayload(playlistUrl, signal);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const videoIds: string[] = [];
  for (const item of items) {
    if (!isRecord(item) || !isRecord(item.contentDetails)) continue;
    const videoId = getString(item.contentDetails, "videoId");
    if (videoId) videoIds.push(videoId);
  }
  return videoIds;
}

/**
 * Finds the channel's current live through its uploads playlist. search.list answers the same
 * question but costs 100 of the 10,000 daily quota units, which is what forced discovery into
 * hour-long retries; channels + playlistItems + videos costs 3 and can run every minute instead.
 */
export async function discoverActiveBroadcast(
  apiKey: string,
  channelHandle: string,
  signal?: AbortSignal,
): Promise<ActiveBroadcast | undefined> {
  const handle = normalizeChannelHandle(channelHandle);
  if (!handle) return undefined;
  const uploadsPlaylistId = await fetchUploadsPlaylistId(apiKey, handle, signal);
  if (!uploadsPlaylistId) return undefined;
  const videoIds = await fetchRecentUploadIds(apiKey, uploadsPlaylistId, signal);
  if (videoIds.length === 0) return undefined;
  const items = await fetchVideoItems(apiKey, videoIds, signal);
  // Only an open chat can be polled: YouTube drops activeLiveChatId as soon as a broadcast ends.
  return items
    .map((item) => toActiveBroadcast(item))
    .find((broadcast) => broadcast?.state.status === "live" && broadcast.liveChatId !== undefined);
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

