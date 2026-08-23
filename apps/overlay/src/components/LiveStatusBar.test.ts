// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createApp } from "vue";
import { createEmptySessionMetrics, type LiveState } from "@miciodev/shared-types";
import LiveStatusBar from "./LiveStatusBar.vue";

function state(overrides: Partial<LiveState> = {}): LiveState {
  return { status: "live", session: createEmptySessionMetrics(), ...overrides };
}

function render(props: Record<string, unknown>): string {
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
  it("hides every metric the relay has not reported rather than showing zeros", () => {
    const html = render({ state: state() });

    expect(html).not.toContain("VIEWERS");
    expect(html).not.toContain("PEAK");
    expect(html).not.toContain("NEW MEMBERS");
    expect(html).not.toContain("STREAM");
  });

  it("renders available metrics with clear labels and locale-aware numbers", () => {
    const html = render({
      state: state({
        concurrentViewers: 12_500,
        peakViewers: 13_004,
        session: { ...createEmptySessionMetrics(), chatMessages: 742, newMembers: 3, superChatRevenueMicros: { EUR: 27_500_000 } },
      }),
    });

    expect(html).toContain("VIEWERS 12,500");
    expect(html).toContain("PEAK 13,004");
    expect(html).toContain("CHAT 742");
    expect(html).toContain("NEW MEMBERS +3");
    expect(html).toMatch(/REVENUE[^<]*27\.50/);
  });

  it("shows gifted memberships with a clear label", () => {
    const html = render({ state: state({ session: { ...createEmptySessionMetrics(), giftedMemberships: 5 } }) });
    expect(html).toContain("GIFTED +5");
  });

  it("shows a members-only badge only while that mode is enabled", () => {
    const chatMode = { id: "mode-1", type: "chat-mode" as const, occurredAt: new Date().toISOString(), author: "YouTube", chatMode: "members-only" as const, enabled: true };
    expect(render({ state: state(), chatMode })).toContain("MEMBERS ONLY");
    expect(render({ state: state(), chatMode: { ...chatMode, enabled: false } })).not.toContain("MEMBERS ONLY");
  });

  it("marks an unhealthy stream so it reads differently from a healthy one", () => {
    expect(render({ state: state({ streamHealth: "error" }) })).toContain("STREAM ERROR");
    expect(render({ state: state({ streamHealth: "unknown" }) })).not.toContain("STREAM");
  });
});
