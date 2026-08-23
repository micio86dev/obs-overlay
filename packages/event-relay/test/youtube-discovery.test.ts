import assert from "node:assert/strict";
import test from "node:test";
import { fetchChannelStatistics } from "../src/sources/youtube-discovery.ts";

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
