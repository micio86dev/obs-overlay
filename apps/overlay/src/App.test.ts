import { computed, createSSRApp, defineComponent, ssrContextKey } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

interface RenderContext {
  [key: string]: unknown;
}

interface RenderedApp {
  setup: (
    props: Record<string, never>,
    context: { expose: (exposed?: Record<string, unknown>) => void }
  ) => RenderContext;
  ssrRender: (
    context: RenderContext,
    push: (content: string) => void,
    parent: null,
    attributes: Record<string, never>,
    props: Record<string, never>,
    setup: RenderContext
  ) => void;
}

const EmptyComponent = defineComponent({ name: "EmptyComponent", setup: () => () => null });

async function renderOverlay(demoMode: boolean): Promise<string> {
  vi.resetModules();
  vi.doMock("./components/AlertQueue.vue", () => ({ default: EmptyComponent }));
  vi.doMock("./components/LiveChatFeed.vue", () => ({ default: EmptyComponent }));
  vi.doMock("./composables/useDemoEvents", () => ({ isDemoMode: () => demoMode, useDemoEvents: vi.fn() }));
  vi.doMock("./composables/useEventStream", () => ({ useEventStream: () => ({ status: computed(() => "LIVE") }) }));

  const { default: App } = await import("./App.vue");
  const renderedApp = App as unknown as RenderedApp;
  const app = createSSRApp({ render: () => null });
  app.provide(ssrContextKey, { modules: new Set<string>() });
  const context = app.runWithContext(() => renderedApp.setup({}, { expose: () => {} }));
  const output: string[] = [];
  renderedApp.ssrRender({}, (content) => output.push(content), null, {}, {}, context);
  return output.join("");
}

afterEach(() => {
  vi.doUnmock("./components/AlertQueue.vue");
  vi.doUnmock("./components/LiveChatFeed.vue");
  vi.doUnmock("./composables/useDemoEvents");
  vi.doUnmock("./composables/useEventStream");
  vi.unstubAllGlobals();
});

describe("overlay branding", () => {
  it("renders all placement placeholders and accessible branding in demo mode", async () => {
    vi.stubGlobal("window", { location: { search: "" } });
    const output = await renderOverlay(true);

    expect(output).toContain("ISCRIVITI CAGNACCIO!");
    expect(output).toContain("DEMO MODE");
    expect(output).toContain("LOGO");
    expect(output).toContain("SCREEN CAPTURE");
    expect(output).toContain("WEBCAM");
    expect(output).toContain('class="logo-frame" role="img" aria-label="Logo placement"');
  });

  it("hides placement placeholders and logo semantics in live mode", async () => {
    vi.stubGlobal("window", { location: { search: "" } });
    const output = await renderOverlay(false);

    expect(output).toContain("ISCRIVITI CAGNACCIO!");
    expect(output).toContain("LIVE");
    expect(output).not.toContain("DEMO MODE");
    expect(output).not.toContain("LOGO");
    expect(output).not.toContain("SCREEN CAPTURE");
    expect(output).not.toContain("WEBCAM");
    expect(output).not.toContain('role="img"');
    expect(output).not.toContain('aria-label="Logo placement"');
    expect(output).not.toContain('aria-label="Screen capture placement"');
    expect(output).toContain('aria-hidden="true"');
  });

  it("renders the near-fullscreen screen-camera layout without a webcam frame", async () => {
    vi.stubGlobal("window", { location: { search: "?layout=screen-camera" } });
    const output = await renderOverlay(true);

    expect(output).toContain('class="overlay layout-screen-camera demo"');
    expect(output).toContain('class="slot screen-slot"');
    expect(output).not.toContain('class="slot webcam-slot"');
    expect(output).toContain('class="feed"');
  });

  it("falls back to the screen-webcam layout for empty and invalid layout values", async () => {
    vi.stubGlobal("window", { location: { search: "" } });
    const emptyLayoutOutput = await renderOverlay(true);

    vi.stubGlobal("window", { location: { search: "?layout=not-a-layout" } });
    const invalidLayoutOutput = await renderOverlay(true);

    for (const output of [emptyLayoutOutput, invalidLayoutOutput]) {
      expect(output).toContain('class="overlay layout-screen-webcam demo"');
      expect(output).toContain('class="slot screen-slot"');
      expect(output).toContain('class="slot webcam-slot"');
    }
  });
});
