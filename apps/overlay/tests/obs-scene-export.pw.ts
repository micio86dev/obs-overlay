import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("the index page's download button produces a valid OBS scene collection", async ({ page }) => {
  await page.goto("/");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download OBS scene collection" }).click(),
  ]);

  expect(download.suggestedFilename()).toBe("MicioDev_Overlay.json");

  const path = await download.path();
  if (!path) throw new Error("download did not save to disk");
  const collection = JSON.parse(await readFile(path, "utf8"));

  expect(collection.resolution).toEqual({ x: 1920, y: 1080 });
  expect(collection.scene_order).toEqual([{ name: "MicioDev Overlay" }]);

  const scene = collection.sources.find((source: { id: string }) => source.id === "scene");
  const browserSources = collection.sources.filter((source: { id: string }) => source.id === "browser_source");
  expect(scene.settings.items).toHaveLength(browserSources.length);
  // Every Browser Source URL must point at this same origin the page was served from, not
  // wherever it happened to be built — otherwise a downloaded file quietly points at localhost.
  for (const source of browserSources) expect(source.settings.url.startsWith(new URL(page.url()).origin)).toBe(true);
});
