import { expect, test, type Page } from "@playwright/test";

async function mockWebSocket(page: Page): Promise<void> {
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
}

test("live mode keeps the placement frame's dashed transparent border, but hides it from assistive tech", async ({ page }) => {
  await mockWebSocket(page);
  await page.goto("/placement?label=Screen");

  // Not discoverable by its demo-mode label: aria-hidden in live mode, unlike placement-frame.pw.ts.
  await expect(page.getByRole("img", { name: "Screen placement" })).toHaveCount(0);

  const frame = page.locator(".placement-frame");
  await expect(frame).toBeVisible();
  await expect(frame).toHaveAttribute("aria-hidden", "true");
  const styles = await frame.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { backgroundColor: computed.backgroundColor, borderStyle: computed.borderStyle };
  });
  expect(styles.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(styles.borderStyle).toBe("dashed");
});

test("live navbar shows the LIVE connection status, not the demo badge", async ({ page }) => {
  await mockWebSocket(page);
  await page.goto("/navbar");

  await expect(page.getByText("DEMO MODE", { exact: true })).toHaveCount(0);
  await expect(page.getByText("LIVE", { exact: true })).toBeVisible();
});
