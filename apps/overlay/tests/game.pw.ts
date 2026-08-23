import { expect, test } from "@playwright/test";

test("game replaces the screen guide while retaining webcam and chat surfaces", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/game");

  await expect(page.getByRole("main")).toHaveClass(/layout-game/);
  await expect(page.getByLabel("Python quiz board")).toBeVisible();
  await expect(page.getByLabel("Python quiz board")).toContainText("Cosa restituisce len([1, 2, 3])?");
  await expect(page.getByLabel("Python quiz board")).toContainText("SCRIVI 1, 2, 3 O 4 IN CHAT");
  await expect(page.getByLabel("Python quiz board")).not.toContainText("Risposta corretta");
  await expect(page.getByText("ARENA PYTHON AUTOMATICA")).toBeVisible();
  await expect(page.getByText("SCRIVI 1, 2, 3 O 4 IN CHAT")).toBeVisible();
  await expect(page.getByLabel("Webcam placement")).toBeVisible();
  await expect(page.getByLabel("Screen capture placement")).toHaveCount(0);
  await expect(page.getByLabel("Live chat")).toBeVisible();
});
