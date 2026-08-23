// @vitest-environment happy-dom
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OverlayEvent } from "@miciodev/shared-types";
import ReactionBurst from "./ReactionBurst.vue";

afterEach(() => { vi.useRealTimers(); });

describe("ReactionBurst", () => {
  it("spawns a floating reaction for each emoji in a new chat message", async () => {
    const events = ref<OverlayEvent[]>([]);
    const root = document.createElement("div");
    const app = createApp(defineComponent({ setup: () => () => h(ReactionBurst, { events: events.value }) }));
    app.mount(root);

    events.value = [{ id: "chat-1", type: "chat", occurredAt: "2026-08-23T12:00:00.000Z", author: "Viewer 1", message: "so good 🔥🔥" }];
    await nextTick();

    expect(root.querySelectorAll(".reaction")).toHaveLength(2);
    app.unmount();
  });

  it("ignores non-chat events and messages without emoji", async () => {
    const events = ref<OverlayEvent[]>([]);
    const root = document.createElement("div");
    const app = createApp(defineComponent({ setup: () => () => h(ReactionBurst, { events: events.value }) }));
    app.mount(root);

    events.value = [
      { id: "poll", type: "poll", occurredAt: "2026-08-23T12:00:00.000Z", author: "Viewer 1", pollStatus: "active", question: "Ship?", choices: [{ text: "Yes" }] },
      { id: "chat-plain", type: "chat", occurredAt: "2026-08-23T12:00:01.000Z", author: "Viewer 2", message: "no emoji here" },
    ];
    await nextTick();

    expect(root.querySelectorAll(".reaction")).toHaveLength(0);
    app.unmount();
  });

  it("removes a reaction once its animation finishes, and clears every timer on unmount", async () => {
    vi.useFakeTimers();
    const events = ref<OverlayEvent[]>([]);
    const root = document.createElement("div");
    const app = createApp(defineComponent({ setup: () => () => h(ReactionBurst, { events: events.value }) }));
    app.mount(root);

    events.value = [{ id: "chat-1", type: "chat", occurredAt: "2026-08-23T12:00:00.000Z", author: "Viewer 1", message: "❤️" }];
    await nextTick();
    expect(root.querySelectorAll(".reaction")).toHaveLength(1);

    vi.advanceTimersByTime(10_000);
    await nextTick();
    expect(root.querySelectorAll(".reaction")).toHaveLength(0);

    app.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never spawns the same event twice, even on an unrelated reactive re-render", async () => {
    const events = ref<OverlayEvent[]>([]);
    const root = document.createElement("div");
    const app = createApp(defineComponent({ setup: () => () => h(ReactionBurst, { events: events.value }) }));
    app.mount(root);
    events.value = [{ id: "chat-1", type: "chat", occurredAt: "2026-08-23T12:00:00.000Z", author: "Viewer 1", message: "🔥" }];
    await nextTick();
    expect(root.querySelectorAll(".reaction")).toHaveLength(1);

    events.value = [...events.value];
    await nextTick();

    expect(root.querySelectorAll(".reaction")).toHaveLength(1);
    app.unmount();
  });
});
