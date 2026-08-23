import { expect, test } from "@playwright/test";

test("?demo=true forces demo mode on a live-mode production build", async ({ page }) => {
  // No WebSocket mock here on purpose: if the override failed, this page would try (and fail) to
  // open a real connection to the production relay and show RECONNECTING, not DEMO MODE.
  await page.goto("/navbar?demo=true");
  await expect(page.getByText("DEMO MODE", { exact: true })).toBeVisible();
});

test("the preview page forces every embedded page into demo mode on a live-mode production build", async ({ page }) => {
  await page.goto("/preview");
  const navbarFrame = page.frameLocator('iframe[title="Navbar"]');
  await expect(navbarFrame.getByText("DEMO MODE", { exact: true })).toBeVisible();
});
