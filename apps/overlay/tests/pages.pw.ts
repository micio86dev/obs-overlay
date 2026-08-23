import { expect, test } from "@playwright/test";

test("background paints the opaque grid — the one page allowed to, since it sits at the bottom of the OBS stack", async ({ page }) => {
  await page.goto("/background");
  const background = page.locator(".background");
  await expect(background).toBeVisible();
  expect(await background.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(5, 7, 6)");
});

test("navbar shows brand copy and demo status without any capture-slot placeholder text", async ({ page }) => {
  await page.goto("/navbar");
  await expect(page.getByText("ISCRIVITI CAGNACCIO!")).toBeVisible();
  await expect(page.getByText("DEMO MODE", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Channel status")).toBeVisible();
});

test("footer renders the live activity bar", async ({ page }) => {
  await page.goto("/footer");
  await expect(page.getByLabel("Live activity")).toBeVisible();
});

test("chat renders the live chat panel", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.getByLabel("Live chat")).toBeVisible();
});

// OBS owns this source's size and position, not the overlay — a bigger source must show more
// messages instead of leaving empty transparent space around a corner-anchored card.
test("the chat panel fills its Browser Source edge-to-edge, whatever size OBS gives it", async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 900 });
  await page.goto("/chat");
  const box = await page.getByLabel("Live chat").boundingBox();
  expect(box).toEqual(expect.objectContaining({ x: 0, y: 0, width: 500, height: 900 }));
});

test("alerts renders its own page, independent of the chat feed", async ({ page }) => {
  await page.goto("/alerts");
  await expect(page.locator(".alerts-page")).toBeVisible();
  await expect(page.getByLabel("Live chat")).toHaveCount(0);
});

test("quiz renders the Python quiz board from the static demo fixture", async ({ page }) => {
  await page.goto("/quiz");
  await expect(page.getByLabel("Python quiz board")).toBeVisible();
  await expect(page.getByLabel("Python quiz board")).toContainText("Cosa restituisce len([1, 2, 3])?");
  await expect(page.getByLabel("Python quiz board")).toContainText("SCRIVI 1, 2, 3 O 4 IN CHAT");
  await expect(page.getByLabel("Python quiz board")).not.toContainText("Risposta corretta");
});

test("the renamed /game and /python-quiz paths still resolve to the quiz page", async ({ page }) => {
  await page.goto("/game");
  await expect(page.getByLabel("Python quiz board")).toBeVisible();
  await page.goto("/python-quiz");
  await expect(page.getByLabel("Python quiz board")).toBeVisible();
});

test("an unrecognized path lands on the index page instead of silently rendering an overlay piece", async ({ page }) => {
  await page.goto("/not-a-real-route");
  await expect(page.getByRole("heading", { name: "MicioDev OBS Overlay" })).toBeVisible();
  await expect(page.getByRole("link", { name: "/quiz" })).toBeVisible();
});

// base.css sets overflow:hidden on html/body/#app for the OBS-facing pages — a Browser Source
// must never show a scrollbar. The index page is normal document content, not a fixed-size
// overlay, so on a short (phone) viewport it needs the browser's own scroll to reach content
// below the fold; IndexPage.vue carries an unscoped override for exactly this page.
test("the index page scrolls on a phone-sized viewport instead of clipping content", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/");

  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const clientHeight = await page.evaluate(() => document.documentElement.clientHeight);
  expect(scrollHeight).toBeGreaterThan(clientHeight);

  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});
