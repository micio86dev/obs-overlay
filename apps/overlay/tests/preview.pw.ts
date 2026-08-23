import { expect, test } from "@playwright/test";

test("preview composes every overlay page into one scaled 1920x1080 canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto("/preview");

  const canvas = page.locator(".canvas");
  await expect(canvas).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(8);

  // Background must be the canvas's own first (furthest-back) iframe, alerts the last (topmost) —
  // the same z-order the OBS scene export builds, since both read the same overlay-layout.ts.
  const titles = await page.locator("iframe").evaluateAll((frames) => frames.map((frame) => frame.getAttribute("title")));
  expect(titles[0]).toBe("Background");
  expect(titles.at(-1)).toBe("Alerts");
});

// Regression test: a grid container's implicit track sizes to an oversized child's own box and
// anchors it at the container's start corner, so place-items (which only centers an item WITHIN
// its track) was a no-op here — the scaled canvas ended up positioned off-center, often mostly
// outside the viewport. Assert the actual centering math, not just that .canvas has some visible
// pixel (toBeVisible() alone stayed green through that bug: a clipped-but-partly-visible element
// still counts as visible).
test("the scaled canvas is actually centered in the viewport, not just partially visible", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto("/preview");

  const canvasBox = await page.locator(".canvas").boundingBox();
  if (!canvasBox) throw new Error("missing .canvas");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("missing viewport");

  expect(canvasBox.x).toBeCloseTo((viewport.width - canvasBox.width) / 2, 0);
  expect(canvasBox.y).toBeCloseTo((viewport.height - canvasBox.height) / 2, 0);
  expect(canvasBox.x).toBeGreaterThanOrEqual(0);
  expect(canvasBox.y).toBeGreaterThanOrEqual(0);
  expect(canvasBox.x + canvasBox.width).toBeLessThanOrEqual(viewport.width);
  expect(canvasBox.y + canvasBox.height).toBeLessThanOrEqual(viewport.height);
});

test("every embedded page renders its demo content, even though the demo config already forces demo mode", async ({ page }) => {
  await page.goto("/preview");
  const navbarFrame = page.frameLocator('iframe[title="Navbar"]');
  await expect(navbarFrame.getByText("DEMO MODE", { exact: true })).toBeVisible();
});
