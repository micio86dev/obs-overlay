import { expect, test, type Page } from "@playwright/test";

/**
 * An OBS capture placed under the browser source is only visible where the page has real
 * alpha. Every element stacked over a placement slot must therefore paint nothing.
 */
async function opaqueLayersOver(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((target) => {
    const slot = document.querySelector(target) as HTMLElement | null;
    if (!slot) throw new Error(`missing ${target}`);
    const box = slot.getBoundingClientRect();
    const points = [
      [box.x + box.width / 2, box.y + box.height / 2],
      [box.x + 8, box.y + 8],
      [box.right - 8, box.bottom - 8],
    ] as const;

    const painted = new Set<string>();
    for (const [x, y] of points) {
      for (const element of document.elementsFromPoint(x, y)) {
        const styles = getComputedStyle(element);
        const hasFill = styles.backgroundColor !== "rgba(0, 0, 0, 0)" && styles.backgroundColor !== "transparent";
        const hasImage = styles.backgroundImage !== "none";
        const hasBackdrop = styles.backdropFilter !== "none";
        if (!hasFill && !hasImage && !hasBackdrop) continue;
        // Panels that deliberately float over a capture are fine; a backdrop behind it is not.
        const isFloatingChrome = element.closest(".live-chat, .live-status, .poll-hud, .alert, .quiz-slot") !== null;
        if (!isFloatingChrome) painted.add(`${element.tagName.toLowerCase()}.${element.className || "(none)"}`);
      }
    }
    return [...painted];
  }, selector);
}

const layouts = [
  { layout: "screen-webcam", selectors: [".screen-slot", ".webcam-slot"] },
  { layout: "screen-only", selectors: [".screen-slot"] },
  { layout: "webcam-only", selectors: [".webcam-slot"] },
  { layout: "screen-camera", selectors: [".screen-slot"] },
];

for (const { layout, selectors } of layouts) {
  test(`${layout} keeps every video placement slot fully see-through`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/?layout=${layout}`);
    await expect(page.getByRole("main")).toHaveClass(new RegExp(`layout-${layout}`));

    for (const selector of selectors) {
      expect(await opaqueLayersOver(page, selector), `${layout} ${selector} must have no painted layer above it`).toEqual([]);
    }
  });
}

test("the document itself carries no opaque backdrop", async ({ page }) => {
  await page.goto("/?layout=screen-webcam");
  const backgrounds = await page.evaluate(() => {
    const app = document.querySelector("#app");
    if (!app) throw new Error("missing #app");
    return [document.documentElement, document.body, app].map((element) => getComputedStyle(element).backgroundColor);
  });

  expect(backgrounds).toEqual(["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"]);
});

test("the chat panel and status bar stay opaque enough to read over any capture", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/?layout=screen-webcam");
  const painted = await page.evaluate(() => [".live-chat", ".live-status"].map((selector) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`missing ${selector}`);
    return getComputedStyle(element).backgroundColor;
  }));

  for (const background of painted) expect(background).not.toBe("rgba(0, 0, 0, 0)");
});
