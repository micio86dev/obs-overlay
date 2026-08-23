import { expect, test, type Locator } from "@playwright/test";

interface PlacementFrameStyles {
  backgroundColor: string;
  borderColor: string;
  borderStyle: string;
  borderRadius: string;
}

async function getFrameStyles(frame: Locator): Promise<PlacementFrameStyles> {
  return frame.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { backgroundColor: styles.backgroundColor, borderColor: styles.borderColor, borderStyle: styles.borderStyle, borderRadius: styles.borderRadius };
  });
}

test("the placement frame is a transparent dashed box with a default radius and demo-mode label", async ({ page }) => {
  await page.goto("/placement?label=Screen");
  const frame = page.getByRole("img", { name: "Screen placement" });
  await expect(frame).toBeVisible();
  await expect(frame).toHaveText("");

  const styles = await getFrameStyles(frame);
  expect(styles.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(styles.borderColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(styles.borderStyle).toBe("dashed");
  expect(styles.borderRadius).toBe("10px");
});

test("the placement frame fills the entire Browser Source, whatever size OBS gives it", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("/placement");
  const box = await page.locator(".placement-frame").boundingBox();
  expect(box).toEqual(expect.objectContaining({ x: 0, y: 0, width: 640, height: 360 }));
});

test("?radius=sm and ?radius=none change the frame's corner radius", async ({ page }) => {
  await page.goto("/placement?radius=sm");
  expect(await page.locator(".placement-frame").evaluate((element) => getComputedStyle(element).borderRadius)).toBe("4px");

  await page.goto("/placement?radius=none");
  expect(await page.locator(".placement-frame").evaluate((element) => getComputedStyle(element).borderRadius)).toBe("0px");
});

test("a real pixel of the dashed border paints the accent-deep color", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 400 });
  await page.goto("/placement");

  const shot = await page.screenshot();
  const isBorderPainted = await page.evaluate(async (base64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + base64;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    // The border is dashed with a fine dash/gap period, so sample every row of the left two
    // columns (not a handful of evenly spaced points) to make it very unlikely every sample
    // aliases into a gap. A pixel counts as painted when it is close to the accent-deep green,
    // tolerating anti-aliasing rather than requiring an exact channel match.
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        if (Math.abs(r - 24) <= 20 && Math.abs(g - 182) <= 20 && Math.abs(b - 76) <= 20) return true;
      }
    }
    return false;
  }, shot.toString("base64"));

  expect(isBorderPainted).toBe(true);
});
