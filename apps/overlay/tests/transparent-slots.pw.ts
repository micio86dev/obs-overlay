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
        // .slot-frame paints its own fill EXCLUDING the slot's rect (mask-composite: exclude cuts a
        // real hole there) — verified against actual pixel alpha below, not re-derived here.
        const hasMaskCutout = /(^|,\s*)(exclude|xor)(\s*,|$)/.test(styles.maskComposite);
        if (!isFloatingChrome && !hasMaskCutout) painted.add(`${element.tagName.toLowerCase()}.${element.className || "(none)"}`);
      }
    }
    return [...painted];
  }, selector);
}

/**
 * opaqueLayersOver only checks that a layer's mask-composite ADMITS a cutout, not that the
 * cutout's actual painted shape covers this point — a mask sized wrong (e.g. too short) would
 * still pass that check while visibly clipping the capture. Sample real pixels instead.
 */
async function isFullyTransparentAt(page: Page, selector: string): Promise<boolean> {
  const box = await page.locator(selector).boundingBox();
  if (box == null) throw new Error(`missing ${selector}`);

  const points = [
    { x: box.x + box.width / 2, y: box.y + 12 },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    { x: box.x + box.width / 2, y: box.y + box.height - 12 },
  ];

  const shot = await page.screenshot();
  return page.evaluate(
    async ({ base64, points: pts }) => {
      const img = new Image();
      img.src = "data:image/png;base64," + base64;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      return pts.every(({ x, y }) => {
        const [r, g, b] = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
        return r > 240 && g > 240 && b > 240;
      });
    },
    { base64: shot.toString("base64"), points }
  );
}

const layouts = [
  { layout: "screen-webcam", selectors: [".screen-slot", ".webcam-slot"] },
  { layout: "screen-only", selectors: [".screen-slot"] },
  { layout: "game", selectors: [".webcam-slot"] },
];

// A vertical OBS canvas (e.g. 1080x1920 for mobile-format live) recomposes these layouts entirely
// (see the portrait media query in App.vue) — the transparency guarantee must hold in both shapes.
const canvases = [
  { name: "landscape", width: 1920, height: 1080 },
  { name: "portrait", width: 1080, height: 1920 },
];

for (const { layout, selectors } of layouts) {
  for (const canvas of canvases) {
    test(`${layout} keeps every video placement slot fully see-through in ${canvas.name}`, async ({ page }) => {
      await page.setViewportSize({ width: canvas.width, height: canvas.height });
      await page.goto(`/${layout}`);
      await expect(page.getByRole("main")).toHaveClass(new RegExp(`layout-${layout}`));

      for (const selector of selectors) {
        expect(await opaqueLayersOver(page, selector), `${layout} ${selector} must have no painted layer above it`).toEqual([]);
      }
    });
  }
}

// Landscape only: the actual OBS canvas size this app targets (see README). The mask hole's real
// painted shape must match the placement slot's own box top-to-bottom, not just "have SOME hole".
for (const { layout, selectors } of layouts) {
  test(`${layout} mask hole covers each placement slot's full height at 1920x1080`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/${layout}`);

    for (const selector of selectors) {
      expect(await isFullyTransparentAt(page, selector), `${layout} ${selector} must be transparent top-to-bottom`).toBe(true);
    }
  });
}

test("the document itself carries no opaque backdrop", async ({ page }) => {
  await page.goto("/screen-webcam");
  const backgrounds = await page.evaluate(() => {
    const app = document.querySelector("#app");
    if (!app) throw new Error("missing #app");
    return [document.documentElement, document.body, app].map((element) => getComputedStyle(element).backgroundColor);
  });

  expect(backgrounds).toEqual(["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"]);
});

test("the chat panel and status bar stay opaque enough to read over any capture", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/screen-webcam");
  const painted = await page.evaluate(() => [".live-chat", ".live-status"].map((selector) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`missing ${selector}`);
    return getComputedStyle(element).backgroundColor;
  }));

  for (const background of painted) expect(background).not.toBe("rgba(0, 0, 0, 0)");
});
