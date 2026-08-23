// @vitest-environment happy-dom
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OverlayEvent } from "@miciodev/shared-types";

const play = vi.fn(async () => undefined);
const dispose = vi.fn();
vi.mock("./alert-sound", () => ({ createAlertSoundPlayer: () => ({ play, dispose, unlock: vi.fn(async () => undefined) }) }));

import AlertQueue from "./AlertQueue.vue";

afterEach(() => { vi.useRealTimers(); play.mockClear(); dispose.mockClear(); });

describe("AlertQueue", () => {
  it("enqueues every event delivered in one reactive burst before selecting priority", async () => {
    const events = ref<OverlayEvent[]>([]);
    const root = document.createElement("div");
    const app = createApp(defineComponent({ setup: () => () => h(AlertQueue, { events: events.value }) }));
    app.mount(root);
    events.value = [
      { id: "poll-burst", type: "poll", occurredAt: "2026-08-23T12:00:00.000Z", author: "Viewer 1", pollStatus: "active", question: "Ship?", choices: [{ text: "Yes" }] },
      { id: "gift-burst", type: "membership-gift", occurredAt: "2026-08-23T12:00:01.000Z", author: "Viewer 2", membershipCount: 5 },
    ];
    await nextTick();
    expect(root.textContent).toContain("MEMBERSHIP GIFT");
    app.unmount();
  });

  it("displays the next queued alert on its timer and clears the timer on unmount", async () => {
    vi.useFakeTimers();
    const events = ref<OverlayEvent[]>([]);
    const root = document.createElement("div");
    const app = createApp(defineComponent({ setup: () => () => h(AlertQueue, { events: events.value }) }));
    app.mount(root);
    events.value = [{ id: "poll", type: "poll", occurredAt: "2026-08-23T12:00:00.000Z", author: "Viewer 1", pollStatus: "active", question: "Ship?", choices: [{ text: "Yes" }] }];
    await nextTick();
    expect(root.textContent).toContain("LIVE POLL");
    events.value = [...events.value, { id: "gift", type: "membership-gift", occurredAt: "2026-08-23T12:00:01.000Z", author: "Viewer 2", membershipCount: 5 }];
    await nextTick();
    vi.advanceTimersByTime(4_800);
    await nextTick();
    expect(root.textContent).toContain("MEMBERSHIP GIFT");
    app.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(dispose).toHaveBeenCalledOnce();
  });
});
