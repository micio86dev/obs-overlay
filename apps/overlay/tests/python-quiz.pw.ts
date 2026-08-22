import { expect, test } from "@playwright/test";

test("python quiz replaces the screen guide while retaining webcam and chat surfaces", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?layout=python-quiz");

  await expect(page.getByRole("main")).toHaveClass(/layout-python-quiz/);
  await expect(page.getByLabel("Python quiz board")).toBeVisible();
  await expect(page.getByLabel("Python quiz board")).toContainText("What does len([1, 2, 3]) return?");
  await expect(page.getByLabel("Python quiz board")).toContainText("CHAT: SEND 1, 2, 3 OR 4");
  await expect(page.getByLabel("Python quiz board")).not.toContainText("Correct answer");
  await expect(page.getByText("AUTONOMOUS PYTHON ARENA")).toBeVisible();
  await expect(page.getByText("CHAT: SEND 1, 2, 3 OR 4")).toBeVisible();
  await expect(page.getByLabel("Webcam placement")).toBeVisible();
  await expect(page.getByLabel("Screen capture placement")).toHaveCount(0);
  await expect(page.getByLabel("Live chat")).toBeVisible();
});
