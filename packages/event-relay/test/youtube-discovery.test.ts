import assert from "node:assert/strict";
import test from "node:test";
import { discoverActiveBroadcast, fetchChannelStatistics } from "../src/sources/youtube-discovery.ts";

async function withMockedFetch<T>(body: Record<string, unknown>, run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))) as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("reads the public subscriber count from channels.list", async () => {
  const statistics = await withMockedFetch(
    { items: [{ statistics: { subscriberCount: "4200", hiddenSubscriberCount: false } }] },
    () => fetchChannelStatistics("key", "@MicioDev"),
  );

  assert.equal(statistics?.subscriberCount, 4_200);
});

test("reports undefined rather than a stale or fabricated number when the channel hides its count", async () => {
  const statistics = await withMockedFetch(
    { items: [{ statistics: { hiddenSubscriberCount: true } }] },
    () => fetchChannelStatistics("key", "@MicioDev"),
  );

  assert.equal(statistics?.subscriberCount, undefined);
});

test("returns undefined for a channel handle that resolves to no channel", async () => {
  const statistics = await withMockedFetch({ items: [] }, () => fetchChannelStatistics("key", "@MicioDev"));

  assert.equal(statistics, undefined);
});

test("returns undefined without a request when the handle is empty", async () => {
  const statistics = await fetchChannelStatistics("key", "   ");

  assert.equal(statistics, undefined);
});

interface FetchRoute {
  match: string;
  body: Record<string, unknown>;
}

async function withRoutedFetch<T>(routes: FetchRoute[], run: (calls: string[]) => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = ((input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    calls.push(url);
    const route = routes.find((candidate) => url.includes(candidate.match));
    if (!route) return Promise.resolve(new Response("{}", { status: 404 }));
    return Promise.resolve(new Response(JSON.stringify(route.body), { status: 200 }));
  }) as typeof fetch;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const channelsRoute: FetchRoute = {
  match: "/channels",
  body: { items: [{ id: "UCabc", contentDetails: { relatedPlaylists: { uploads: "UUabc" } } }] },
};

test("discovers the active broadcast through the uploads playlist rather than search.list", async () => {
  const broadcast = await withRoutedFetch(
    [
      channelsRoute,
      { match: "/playlistItems", body: { items: [{ contentDetails: { videoId: "vid-live" } }] } },
      {
        match: "/videos",
        body: {
          items: [{
            id: "vid-live",
            liveStreamingDetails: { actualStartTime: "2026-08-24T17:00:00Z", activeLiveChatId: "chat-1", concurrentViewers: "42" },
          }],
        },
      },
    ],
    async (calls) => {
      const result = await discoverActiveBroadcast("key", "@MicioDev");
      assert.equal(calls.some((url) => url.includes("/search")), false, "search.list costs 100 quota units and must not be used");
      return result;
    },
  );

  assert.equal(broadcast?.videoId, "vid-live");
  assert.equal(broadcast?.liveChatId, "chat-1");
  assert.equal(broadcast?.state.status, "live");
  assert.equal(broadcast?.state.concurrentViewers, 42);
});

test("checks every recent upload in one batched videos.list call and skips finished broadcasts", async () => {
  const videosUrls: string[] = [];
  const broadcast = await withRoutedFetch(
    [
      channelsRoute,
      {
        match: "/playlistItems",
        body: { items: [{ contentDetails: { videoId: "vid-old" } }, { contentDetails: { videoId: "vid-live" } }] },
      },
      {
        match: "/videos",
        body: {
          items: [
            { id: "vid-old", liveStreamingDetails: { actualStartTime: "2026-08-23T10:00:00Z", actualEndTime: "2026-08-23T12:00:00Z" } },
            { id: "vid-live", liveStreamingDetails: { actualStartTime: "2026-08-24T17:00:00Z", activeLiveChatId: "chat-2" } },
          ],
        },
      },
    ],
    async (calls) => {
      const result = await discoverActiveBroadcast("key", "MicioDev");
      videosUrls.push(...calls.filter((url) => url.includes("/videos")));
      return result;
    },
  );

  assert.equal(videosUrls.length, 1, "one batched lookup keeps discovery at a single quota unit");
  assert.match(decodeURIComponent(videosUrls[0]), /id=vid-old,vid-live/);
  assert.equal(broadcast?.videoId, "vid-live");
  assert.equal(broadcast?.liveChatId, "chat-2");
});

test("returns undefined when no recent upload is currently live", async () => {
  const broadcast = await withRoutedFetch(
    [
      channelsRoute,
      { match: "/playlistItems", body: { items: [{ contentDetails: { videoId: "vid-old" } }] } },
      {
        match: "/videos",
        body: { items: [{ id: "vid-old", liveStreamingDetails: { actualStartTime: "2026-08-23T10:00:00Z", actualEndTime: "2026-08-23T12:00:00Z" } }] },
      },
    ],
    () => discoverActiveBroadcast("key", "MicioDev"),
  );

  assert.equal(broadcast, undefined);
});

test("stops before the playlist lookup when the handle resolves to no channel", async () => {
  const calls = await withRoutedFetch([{ match: "/channels", body: { items: [] } }], async (requests) => {
    assert.equal(await discoverActiveBroadcast("key", "@ghost"), undefined);
    return requests;
  });

  assert.equal(calls.length, 1, "an unknown handle must not spend further quota");
});
