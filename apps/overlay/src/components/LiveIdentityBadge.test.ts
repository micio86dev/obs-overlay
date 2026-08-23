// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createApp } from "vue";
import { createEmptySessionMetrics, type LiveState } from "@miciodev/shared-types";
import LiveIdentityBadge from "./LiveIdentityBadge.vue";

function state(overrides: Partial<LiveState> = {}): LiveState {
  return { status: "live", session: createEmptySessionMetrics(), ...overrides };
}

/** Mounts for real so the live clock's timer lifecycle is exercised, then tears it down. */
function render(props: Record<string, unknown>): string {
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp(LiveIdentityBadge, props);
  app.mount(host);
  const html = host.innerHTML;
  app.unmount();
  host.remove();
  return html;
}

describe("LiveIdentityBadge", () => {
  it("labels demo mode without claiming the broadcast state", () => {
    expect(render({ state: state({ status: "unknown" }), demo: true })).toContain("DEMO");
  });

  it("counts down to a scheduled start and up once live", () => {
    const upcoming = render({ state: state({ status: "upcoming", scheduledStartAt: new Date(Date.now() + 90_000).toISOString() }) });
    expect(upcoming).toContain("UPCOMING");

    const live = render({ state: state({ status: "live", startedAt: new Date(Date.now() - 3_600_000).toISOString() }) });
    expect(live).toContain("LIVE");
    expect(live).toMatch(/01:00:0\d/);
  });

  it("freezes the timer once the broadcast is complete", () => {
    const html = render({ state: state({ status: "complete", startedAt: "2026-08-23T10:00:00.000Z", endedAt: "2026-08-23T12:00:00.000Z" }) });
    expect(html).toContain("02:00:00");
  });

  it("shows the subscriber count only when YouTube reports one", () => {
    expect(render({ state: state({ subscriberCount: 4_200 }) })).toContain("4,200 SUBSCRIBERS");
    expect(render({ state: state() })).not.toContain("SUBSCRIBERS");
  });
});
