import assert from "node:assert/strict";
import test from "node:test";
import { MockSource } from "../src/sources/mock-source.ts";
import {
  clampPollInterval,
  discoverActiveLiveChatId,
  normalizeChannelHandle,
  YouTubeSource,
} from "../src/sources/youtube-source.ts";

test("normalizeChannelHandle accepts an optional at sign", () => {
  assert.equal(normalizeChannelHandle("@miciodev"), "miciodev");
  assert.equal(normalizeChannelHandle("  miciodev  "), "miciodev");
  assert.equal(normalizeChannelHandle("@"), undefined);
});

test("discoverActiveLiveChatId resolves the current live chat from a channel handle", async () => {
  const originalFetch = globalThis.fetch;
  const urls: URL[] = [];
  globalThis.fetch = ((input) => {
    const url = new URL(String(input));
    urls.push(url);
    const payload = url.pathname.endsWith("/channels")
      ? { items: [{ id: "channel-1" }] }
      : url.pathname.endsWith("/search")
        ? { items: [{ id: { videoId: "live-video-1" } }] }
        : { items: [{ liveStreamingDetails: { activeLiveChatId: "live-chat-1" } }] };
    return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
  }) as typeof fetch;

  try {
    assert.equal(await discoverActiveLiveChatId("api-key", "@miciodev"), "live-chat-1");
    assert.equal(urls[0]?.pathname, "/youtube/v3/channels");
    assert.equal(urls[0]?.searchParams.get("forHandle"), "miciodev");
    assert.equal(urls[1]?.searchParams.get("eventType"), "live");
    assert.equal(urls[1]?.searchParams.get("channelId"), "channel-1");
    assert.equal(urls[2]?.searchParams.get("part"), "liveStreamingDetails");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("discoverActiveLiveChatId returns undefined when the channel has no current live", async () => {
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = (() => {
    fetches += 1;
    return Promise.resolve(new Response(JSON.stringify(fetches === 1 ? { items: [{ id: "channel-1" }] } : { items: [] }), { status: 200 }));
  }) as typeof fetch;

  try {
    assert.equal(await discoverActiveLiveChatId("api-key", "miciodev"), undefined);
    assert.equal(fetches, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("YouTubeSource exponentially backs off active-live discovery when no live is active", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const originalConsoleInfo = console.info;
  const timers: Array<{ handler: TimerHandler; delay: number; cleared: boolean }> = [];
  console.info = () => undefined;
  globalThis.fetch = ((input) => {
    const url = new URL(String(input));
    const payload = url.pathname.endsWith("/channels") ? { items: [{ id: "channel-1" }] } : { items: [] };
    return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
  }) as typeof fetch;
  globalThis.setTimeout = ((handler: TimerHandler, delay = 0) => {
    timers.push({ handler, delay, cleared: false });
    return timers.length as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
    const timer = timers[Number(id) - 1];
    if (timer) timer.cleared = true;
  }) as typeof clearTimeout;
  let source: YouTubeSource | undefined;

  try {
    source = new YouTubeSource("key", undefined, 1_000, 15_000, "miciodev");
    source.start();
    await new Promise<void>((resolve) => originalSetTimeout(resolve, 0));
    const firstRetry = timers.find((timer) => timer.delay === 300_000 && !timer.cleared);
    assert.ok(firstRetry);
    firstRetry.handler();
    await new Promise<void>((resolve) => originalSetTimeout(resolve, 0));
    assert.ok(timers.some((timer) => timer.delay === 600_000 && !timer.cleared));
  } finally {
    source?.stop();
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    console.info = originalConsoleInfo;
  }
});

test("YouTubeSource rebinds to a newly discovered live chat after the previous chat ends", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const originalConsoleInfo = console.info;
  const liveChatIds: string[] = [];
  const received: string[] = [];
  const timers: Array<{ handler: TimerHandler; delay: number; cleared: boolean }> = [];
  let discovery = 0;
  console.info = () => undefined;
  globalThis.fetch = ((input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/channels")) {
      discovery += 1;
      return Promise.resolve(new Response(JSON.stringify({ items: [{ id: "channel-1" }] }), { status: 200 }));
    }
    if (url.pathname.endsWith("/search")) {
      return Promise.resolve(new Response(JSON.stringify({ items: [{ id: { videoId: `video-${discovery}` } }] }), { status: 200 }));
    }
    if (url.pathname.endsWith("/videos")) {
      return Promise.resolve(new Response(JSON.stringify({ items: [{ liveStreamingDetails: { activeLiveChatId: `chat-${discovery}` } }] }), { status: 200 }));
    }
    liveChatIds.push(url.searchParams.get("liveChatId") ?? "");
    return Promise.resolve(discovery === 1
      ? new Response(JSON.stringify({ error: { errors: [{ reason: "liveChatEnded" }] } }), { status: 403 })
      : new Response(JSON.stringify({
        items: [{
          id: "message-after-rebind",
          snippet: { type: "textMessageEvent", publishedAt: "2026-08-22T00:00:00.000Z", displayMessage: "Back online" },
          authorDetails: { displayName: "MicioFan" },
        }],
        pollingIntervalMillis: 1_000,
      }), { status: 200 }));
  }) as typeof fetch;
  globalThis.setTimeout = ((handler: TimerHandler, delay = 0) => {
    timers.push({ handler, delay, cleared: false });
    return timers.length as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
    const timer = timers[Number(id) - 1];
    if (timer) timer.cleared = true;
  }) as typeof clearTimeout;
  let source: YouTubeSource | undefined;

  try {
    source = new YouTubeSource("key", undefined, 1_000, 15_000, "@miciodev");
    source.subscribe((event) => received.push(event.id));
    source.start();
    await new Promise<void>((resolve) => originalSetTimeout(resolve, 0));
    const retry = timers.find((timer) => timer.delay === 300_000 && !timer.cleared);
    assert.ok(retry);
    retry.handler();
    await new Promise<void>((resolve) => originalSetTimeout(resolve, 0));
    assert.deepEqual(liveChatIds, ["chat-1", "chat-2"]);
    assert.deepEqual(received, ["message-after-rebind"]);
  } finally {
    source?.stop();
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    console.info = originalConsoleInfo;
  }
});

test("MockSource emits normalized rotating stream events", () => {
  const source = new MockSource(60_000);
  const received: string[] = [];
  source.subscribe((event) => received.push(event.type));

  source.emitNext();
  source.emitNext();
  source.emitNext();

  assert.deepEqual(received, ["chat", "subscriber", "superchat"]);
  source.stop();
});

test("MockSource start and stop are idempotent", () => {
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let schedules = 0;
  globalThis.setInterval = ((handler: TimerHandler) => { void handler; schedules += 1; return 1 as unknown as ReturnType<typeof setInterval>; }) as typeof setInterval;
  globalThis.clearInterval = (() => undefined) as typeof clearInterval;

  try {
    const source = new MockSource();
    source.start();
    source.start();
    source.stop();
    source.stop();
    assert.equal(schedules, 1);
  } finally {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});

test("YouTubeSource does not reschedule an in-flight poll after stop", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  let resolveFetch: ((value: Response) => void) | undefined;
  let signal: AbortSignal | undefined;
  const scheduledDelays: number[] = [];
  globalThis.fetch = ((_input, init) => {
    signal = init?.signal ?? undefined;
    return new Promise<Response>((resolve) => { resolveFetch = resolve; });
  }) as typeof fetch;
  globalThis.setTimeout = ((_handler: TimerHandler, delay = 0) => {
    scheduledDelays.push(delay);
    return 1 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  try {
    const source = new YouTubeSource("key", "chat", Number.NaN);
    source.start();
    source.stop();
    assert.equal(signal?.aborted, true);
    resolveFetch?.(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    await new Promise<void>((resolve) => originalSetTimeout(resolve, 0));
    assert.deepEqual(scheduledDelays, [15_000]);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("YouTubeSource ignores stale poll results after a stop and restart", async () => {
  const originalFetch = globalThis.fetch;
  let firstResolve: ((value: Response) => void) | undefined;
  let fetches = 0;
  const received: string[] = [];
  globalThis.fetch = (() => {
    fetches += 1;
    if (fetches === 1) return new Promise<Response>((resolve) => { firstResolve = resolve; });
    return new Promise<Response>(() => undefined);
  }) as typeof fetch;

  try {
    const source = new YouTubeSource("key", "chat");
    source.subscribe((event) => received.push(event.id));
    source.start();
    source.stop();
    source.start();
    firstResolve?.(new Response(JSON.stringify({ items: [{ id: "stale", snippet: { type: "textMessageEvent", publishedAt: "2026-08-22T00:00:00.000Z", displayMessage: "old" }, authorDetails: { displayName: "MicioFan" } }] }), { status: 200 }));
    await new Promise<void>((resolve) => originalFetch === globalThis.fetch ? resolve() : setTimeout(resolve, 0));
    assert.equal(received.length, 0);
    source.stop();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("YouTubeSource skips malformed entries while publishing valid entries from the same poll", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleWarn = console.warn;
  const received: string[] = [];
  console.warn = () => undefined;
  globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({
    items: [
      { id: "broken", snippet: null },
      { id: "chat-1", snippet: { type: "textMessageEvent", publishedAt: "2026-08-22T00:00:00.000Z", displayMessage: "still here" }, authorDetails: { displayName: "MicioFan" } },
    ],
  }), { status: 200 }))) as typeof fetch;

  try {
    const source = new YouTubeSource("key", "chat");
    source.subscribe((event) => received.push(event.id));
    source.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(received, ["chat-1"]);
    source.stop();
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalConsoleWarn;
  }
});

test("YouTubeSource skips super chats that omit superChatDetails", async () => {
  const originalFetch = globalThis.fetch;
  const received: string[] = [];
  globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({
    items: [
      { id: "broken-superchat", snippet: { type: "superChatEvent", publishedAt: "2026-08-22T00:00:00.000Z" }, authorDetails: { displayName: "MicioFan" } },
      { id: "chat-1", snippet: { type: "textMessageEvent", publishedAt: "2026-08-22T00:00:00.000Z", displayMessage: "still here" }, authorDetails: { displayName: "MicioFan" } },
    ],
  }), { status: 200 }))) as typeof fetch;

  try {
    const source = new YouTubeSource("key", "chat");
    source.subscribe((event) => received.push(event.id));
    source.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(received, ["chat-1"]);
    source.stop();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("YouTubeSource carries the API page token to the following poll and clears it when absent", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const urls: URL[] = [];
  const timers: Array<{ handler: TimerHandler; delay: number; cleared: boolean }> = [];
  globalThis.fetch = ((input) => {
    urls.push(new URL(String(input)));
    return Promise.resolve(new Response(JSON.stringify(urls.length === 1
      ? { items: [], nextPageToken: "next-page", pollingIntervalMillis: 1_000 }
      : { items: [], pollingIntervalMillis: 1_000 }), { status: 200 }));
  }) as typeof fetch;
  globalThis.setTimeout = ((handler: TimerHandler, delay = 0) => {
    timers.push({ handler, delay, cleared: false });
    return timers.length as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
    const timer = timers[Number(id) - 1];
    if (timer) timer.cleared = true;
  }) as typeof clearTimeout;
  let source: YouTubeSource | undefined;

  try {
    source = new YouTubeSource("key", "chat");
    source.start();
    await new Promise<void>((resolve) => originalSetTimeout(resolve, 0));
    const followUpPoll = timers.find((timer) => timer.delay === 1_000 && !timer.cleared);
    assert.ok(followUpPoll);
    followUpPoll.handler();
    await new Promise<void>((resolve) => originalSetTimeout(resolve, 0));
    assert.equal(urls[0]?.searchParams.get("pageToken"), null);
    assert.equal(urls[1]?.searchParams.get("pageToken"), "next-page");
    const resetPoll = timers.filter((timer) => timer.delay === 1_000 && !timer.cleared).at(-1);
    assert.ok(resetPoll);
    resetPoll.handler();
    await new Promise<void>((resolve) => originalSetTimeout(resolve, 0));
    assert.equal(urls[2]?.searchParams.get("pageToken"), null);
  } finally {
    source?.stop();
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("YouTubeSource retries a stalled poll after its fetch timeout without leaking the timeout", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers: Array<{ handler: TimerHandler; delay: number; cleared: boolean }> = [];
  let requestSignal: AbortSignal | undefined;
  globalThis.fetch = ((_input, init) => new Promise<Response>((_resolve, reject) => {
    requestSignal = init?.signal;
    requestSignal?.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")), { once: true });
  })) as typeof fetch;
  globalThis.setTimeout = ((handler: TimerHandler, delay = 0) => {
    timers.push({ handler, delay, cleared: false });
    return timers.length as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
    const timer = timers[Number(id) - 1];
    if (timer) timer.cleared = true;
  }) as typeof clearTimeout;
  let source: YouTubeSource | undefined;

  try {
    source = new YouTubeSource("key", "chat", 10_000, 1_000);
    source.start();
    const timeout = timers.find((timer) => timer.delay === 1_000);
    assert.ok(timeout);
    timeout.handler();
    await new Promise<void>((resolve) => originalSetTimeout(resolve, 0));
    assert.equal(requestSignal?.aborted, true);
    assert.ok(timers.some((timer) => timer.delay === 10_000 && !timer.cleared));
    assert.equal(timeout.cleared, true);
  } finally {
    source?.stop();
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});


test("YouTubeSource clamps invalid polling intervals to a quota-safe range", () => {
  assert.equal(clampPollInterval(Number.NaN), 10_000);
  assert.equal(clampPollInterval(1), 1_000);
  assert.equal(clampPollInterval(120_000), 60_000);
});

test("YouTubeSource start is idempotent", () => {
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = (() => {
    fetches += 1;
    return new Promise<Response>(() => undefined);
  }) as typeof fetch;

  try {
    const source = new YouTubeSource("key", "chat");
    source.start();
    source.start();
    source.stop();
    assert.equal(fetches, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
