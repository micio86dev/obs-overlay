// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createApp } from "vue";
import { createEmptySessionMetrics, type LiveState } from "@miciodev/shared-types";
import LiveStatusBar from "./LiveStatusBar.vue";

function state(overrides: Partial<LiveState> = {}): LiveState {
  return { status: "live", session: createEmptySessionMetrics(), ...overrides };
}

/** Mounts for real so the live clock's timer lifecycle is exercised, then tears it down. */
async function render(props: Record<string, unknown>): Promise<string> {
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp(LiveStatusBar, props);
  app.mount(host);
  const html = host.innerHTML;
  app.unmount();
  host.remove();
  return html;
}

describe("LiveStatusBar", () => {
  it("hides every metric the relay has not reported rather than showing zeros", async () => {
    const html = await render({ state: state() });

    expect(html).toContain("LIVE");
    expect(html).not.toContain("◉");
    expect(html).not.toContain("PEAK");
    expect(html).not.toContain("MEM +");
    expect(html).not.toContain("STREAM");
  });

  it("renders available metrics with locale-aware numbers", async () => {
    const html = await render({
      state: state({
        concurrentViewers: 12_500,
        peakViewers: 13_004,
        session: { ...createEmptySessionMetrics(), chatMessages: 742, newMembers: 3, superChatRevenueMicros: { EUR: 27_500_000 } },
      }),
    });

    expect(html).toContain("12,500");
    expect(html).toContain("13,004");
    expect(html).toContain("742");
    expect(html).toContain("MEM +3");
    expect(html).toMatch(/27\.50/);
  });

  it("labels demo mode without claiming the broadcast state", async () => {
    expect(await render({ state: state({ status: "unknown" }), demo: true })).toContain("DEMO");
  });

  it("counts down to a scheduled start and up once live", async () => {
    const upcoming = await render({ state: state({ status: "upcoming", scheduledStartAt: new Date(Date.now() + 90_000).toISOString() }) });
    expect(upcoming).toContain("STARTS");

    const live = await render({ state: state({ status: "live", startedAt: new Date(Date.now() - 3_600_000).toISOString() }) });
    expect(live).toContain("LIVE FOR");
    expect(live).toMatch(/01:00:0\d/);
  });

  it("shows a members-only badge only while that mode is enabled", async () => {
    const chatMode = { id: "mode-1", type: "chat-mode" as const, occurredAt: new Date().toISOString(), author: "YouTube", chatMode: "members-only" as const, enabled: true };
    expect(await render({ state: state(), chatMode })).toContain("MEMBERS ONLY");
    expect(await render({ state: state(), chatMode: { ...chatMode, enabled: false } })).not.toContain("MEMBERS ONLY");
  });

  it("marks an unhealthy stream so it reads differently from a healthy one", async () => {
    expect(await render({ state: state({ streamHealth: "error" }) })).toContain("STREAM ERROR");
    expect(await render({ state: state({ streamHealth: "unknown" }) })).not.toContain("STREAM");
  });

  it("freezes the timer once the broadcast is complete", async () => {
    const html = await render({ state: state({ status: "complete", startedAt: "2026-08-23T10:00:00.000Z", endedAt: "2026-08-23T12:00:00.000Z" }) });
    expect(html).toContain("02:00:00");
  });
});
