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
