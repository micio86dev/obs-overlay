import { expect, test } from "@playwright/test";

const relayEventsUrl = "wss://obs-overlay-relay-production.up.railway.app/events";

test("builds the overlay in live mode with the Railway relay endpoint", async ({ page }) => {
  await page.addInitScript(() => {
    class MockWebSocket extends EventTarget {
      public constructor(url: string) {
        super();
        void url;
        queueMicrotask(() => this.dispatchEvent(new Event("open")));
      }

      public close(): void {}
    }

    Object.defineProperty(window, "WebSocket", { configurable: true, value: MockWebSocket });
  });
  await page.goto("/?layout=screen-camera");

  await expect(page.getByRole("main")).not.toHaveClass(/demo/);
  await expect(page.getByText("DEMO MODE", { exact: true })).toHaveCount(0);
  await expect(page.getByText("LIVE", { exact: true })).toBeVisible();

  const emittedModule = await page.locator('script[type="module"]').evaluate(async (element) => {
    const sourceUrl = (element as HTMLScriptElement).src;
    return fetch(sourceUrl).then(async (response) => response.text());
  });

  expect(emittedModule).toContain(relayEventsUrl);
});
