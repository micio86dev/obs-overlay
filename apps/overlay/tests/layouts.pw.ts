import { expect, test, type Locator } from "@playwright/test";

interface PlacementFrameStyles {
  backgroundColor: string;
  borderColor: string;
  borderStyle: string;
}

async function getPlacementFrameStyles(frame: Locator): Promise<PlacementFrameStyles> {
  return frame.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      borderColor: styles.borderColor,
      borderStyle: styles.borderStyle
    };
  });
}

async function expectTransparentDashedFrame(frame: Locator): Promise<void> {
  await expect(frame).toBeVisible();
  const styles = await getPlacementFrameStyles(frame);
  expect(styles.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(styles.borderColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(styles.borderStyle).toBe("dashed");
}

test("screen-webcam keeps dashed transparent screen, webcam, and logo frames in their intended columns", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/screen-webcam");
  const screenFrame = page.getByLabel("Screen capture placement");
  const webcamFrame = page.getByLabel("Webcam placement");
  const logoFrame = page.getByRole("img", { name: "Logo placement" });

  await expect(page.getByRole("main")).toHaveClass(/layout-screen-webcam/);
  await expect(screenFrame).toHaveText("");
  await expect(webcamFrame).toHaveText("");
  await expect(logoFrame).toHaveText("");
  await Promise.all([
    expectTransparentDashedFrame(screenFrame),
    expectTransparentDashedFrame(webcamFrame),
    expectTransparentDashedFrame(logoFrame)
  ]);

  const [screenBox, webcamBox] = await Promise.all([screenFrame.boundingBox(), webcamFrame.boundingBox()]);
  if (screenBox == null || webcamBox == null) throw new Error("Expected screen and webcam placement frames");

  expect(screenBox.x + screenBox.width).toBeLessThan(webcamBox.x);
  expect(screenBox.width).toBeGreaterThan(webcamBox.width);
  expect(screenBox.height).toBeGreaterThan(webcamBox.height);
});

// The screen frame targets 16:10 (1.6:1), between broadcast 16:9 and a MacBook's actual panel
// ratio, not 16:9 — a 16:9 box would letterbox a laptop screen capture. The webcam frame stays
// 16:9, the standard ratio for webcams regardless of what screen is being shared.
const SCREEN_RATIO = 16 / 10;
const sixteenByNineLayouts = [
  { layout: "screen-webcam", frames: [{ name: "screen", ratio: SCREEN_RATIO }, { name: "webcam", ratio: 16 / 9 }] },
  { layout: "screen-only", frames: [{ name: "screen", ratio: SCREEN_RATIO }] },
  { layout: "game", frames: [{ name: "webcam", ratio: 16 / 9 }] },
];

for (const { layout, frames } of sixteenByNineLayouts) {
  test(`${layout} sizes every capture frame to its fixed aspect ratio`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/${layout}`);

    for (const { name, ratio } of frames) {
      const box = await page.locator(`[data-placement-frame="${name}"]`).boundingBox();
      if (box == null) throw new Error(`missing ${name} frame in ${layout}`);
      expect(box.width / box.height, `${layout} ${name}`).toBeCloseTo(ratio, 1);
      expect(box.y + box.height).toBeLessThanOrEqual(1080);
    }
  });
}

/**
 * getComputedStyle reports a declared border regardless of whether it actually paints a pixel:
 * a masked ancestor (mask/clip-path clip an element's WHOLE rendered subtree, not just its own
 * background) can make a child's real border invisible while its computed style still looks
 * correct — this shipped once, undetected by expectTransparentDashedFrame above. Sample the
 * actual rendered pixel at the border's own coordinate to catch that class of bug for real.
 */
for (const { layout, frames } of sixteenByNineLayouts) {
  test(`${layout} paints a real green pixel on every capture frame's dashed border`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/${layout}`);

    for (const { name } of frames) {
      const box = await page.locator(`[data-placement-frame="${name}"]`).boundingBox();
      if (box == null) throw new Error(`missing ${name} frame in ${layout}`);

      const shot = await page.screenshot();
      // Sample several points along the left edge, not just the vertical center: the border is
      // dashed, so a single point can land in a gap between dashes rather than on a dash itself.
      const isBorderGreen = await page.evaluate(
        async ({ base64, x, box }) => {
          const img = new Image();
          img.src = "data:image/png;base64," + base64;
          await img.decode();
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          for (let step = 0; step < 10; step++) {
            const y = Math.round(box.y + (box.height * step) / 10);
            const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
            if (r === 24 && g === 182 && b === 76) return true;
          }
          return false;
        },
        { base64: shot.toString("base64"), x: Math.round(box.x), box }
      );
      expect(isBorderGreen, `${layout} ${name} left border must paint at least one real #18b64c pixel`).toBe(true);
    }
  });
}
