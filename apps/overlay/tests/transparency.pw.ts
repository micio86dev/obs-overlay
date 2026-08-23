import { expect, test } from "@playwright/test";

async function documentBackgrounds(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(() => {
    const app = document.querySelector("#app");
    if (!app) throw new Error("missing #app");
    return [document.documentElement, document.body, app].map((element) => getComputedStyle(element).backgroundColor);
  });
}

// background is the one deliberate exception: it is meant to be the opaque bottom layer of the
// OBS stack, so it is not covered by this test — see pages.pw.ts.
const transparentPages = ["/navbar", "/footer", "/chat", "/alerts", "/quiz", "/placement"];

for (const path of transparentPages) {
  test(`${path} carries no opaque document backdrop, so lower OBS sources show through`, async ({ page }) => {
    await page.goto(path);
    expect(await documentBackgrounds(page)).toEqual(["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"]);
  });
}

test("the chat panel and status bar stay opaque enough to read over any capture", async ({ page }) => {
  await page.goto("/chat");
  expect(await page.locator(".live-chat").evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");

  await page.goto("/footer");
  expect(await page.locator(".live-status").evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
});
