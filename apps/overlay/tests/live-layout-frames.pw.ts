import { expect, test, type Locator, type Page } from "@playwright/test";

interface PlacementFrameStyles {
  backgroundColor: string;
  borderColor: string;
  borderStyle: string;
}

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

async function expectTransparentDashedFrame(frame: Locator): Promise<void> {
  await expect(frame).toBeVisible();
  const styles = await frame.evaluate((element): PlacementFrameStyles => {
    const computedStyles = getComputedStyle(element);
    return {
      backgroundColor: computedStyles.backgroundColor,
      borderColor: computedStyles.borderColor,
      borderStyle: computedStyles.borderStyle
    };
  });

  expect(styles.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(styles.borderColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(styles.borderStyle).toBe("dashed");
}

test("live screen-camera keeps only screen and logo placement frames", async ({ page }) => {
  await mockWebSocket(page);
  await page.goto("/?layout=screen-camera");
  const screenFrame = page.locator('[data-placement-frame="screen"]');
  const webcamFrame = page.locator('[data-placement-frame="webcam"]');
  const logoFrame = page.getByRole("img", { name: "Logo placement" });

  await expect(page.getByRole("main")).toHaveClass(/layout-screen-camera/);
  await expect(page.getByRole("main")).not.toHaveClass(/demo/);
  await expect(screenFrame).toHaveCount(1);
  await expect(webcamFrame).toHaveCount(0);
  await Promise.all([
    expectTransparentDashedFrame(screenFrame),
    expectTransparentDashedFrame(logoFrame)
  ]);
});

test("live screen-webcam keeps screen, webcam, and logo placement frames", async ({ page }) => {
  await mockWebSocket(page);
  await page.goto("/?layout=screen-webcam");
  const screenFrame = page.locator('[data-placement-frame="screen"]');
  const webcamFrame = page.locator('[data-placement-frame="webcam"]');
  const logoFrame = page.getByRole("img", { name: "Logo placement" });

  await expect(page.getByRole("main")).toHaveClass(/layout-screen-webcam/);
  await expect(page.getByRole("main")).not.toHaveClass(/demo/);
  await Promise.all([
    expectTransparentDashedFrame(screenFrame),
    expectTransparentDashedFrame(webcamFrame),
    expectTransparentDashedFrame(logoFrame)
  ]);
});
