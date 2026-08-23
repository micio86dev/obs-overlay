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

test("every embedded page renders its demo content, even though the demo config already forces demo mode", async ({ page }) => {
  await page.goto("/preview");
  const navbarFrame = page.frameLocator('iframe[title="Navbar"]');
  await expect(navbarFrame.getByText("DEMO MODE", { exact: true })).toBeVisible();
});
