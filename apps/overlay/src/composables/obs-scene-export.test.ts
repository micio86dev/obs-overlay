import { describe, expect, it } from "vitest";
import { buildObsSceneCollection } from "./obs-scene-export";

function sequentialUuids(): () => string {
  let n = 0;
  return () => `uuid-${n++}`;
}

describe("buildObsSceneCollection", () => {
  it("builds exactly one scene referencing every overlay page as its own browser source", () => {
    const collection = buildObsSceneCollection("http://localhost:5173", sequentialUuids());
    const sources = collection.sources as Record<string, unknown>[];
    const scenes = sources.filter((source) => source.id === "scene");
    const browserSources = sources.filter((source) => source.id === "browser_source");

    expect(scenes).toHaveLength(1);
    expect(browserSources.length).toBeGreaterThan(0);
    expect(collection.scene_order).toEqual([{ name: scenes[0]!.name }]);
    expect(collection.current_scene).toBe(scenes[0]!.name);
    expect(collection.current_program_scene).toBe(scenes[0]!.name);

    const items = (scenes[0]!.settings as { items: Record<string, unknown>[] }).items;
    expect(items).toHaveLength(browserSources.length);
    // Every scene item must reference a real source by uuid, and every browser source's URL must
    // point at this origin — a wrong origin here would silently ship someone else's overlay.
    const uuidsBySource = new Set(browserSources.map((source) => source.uuid));
    for (const item of items) expect(uuidsBySource.has(item.source_uuid)).toBe(true);
    for (const source of browserSources) {
      const url = (source.settings as { url: string }).url;
      expect(url.startsWith("http://localhost:5173/")).toBe(true);
    }
  });

  it("stacks background first (furthest back) and alerts last (topmost)", () => {
    const collection = buildObsSceneCollection("http://localhost:5173", sequentialUuids());
    const scene = (collection.sources as Record<string, unknown>[]).find((source) => source.id === "scene")!;
    const items = (scene.settings as { items: Record<string, unknown>[] }).items;

    expect(items[0]!.name).toBe("Background");
    expect(items.at(-1)!.name).toBe("Alerts");
  });

  it("gives every source and the scene a unique uuid", () => {
    const collection = buildObsSceneCollection("http://localhost:5173");
    const sources = collection.sources as Record<string, unknown>[];
    const uuids = sources.map((source) => source.uuid);
    expect(new Set(uuids).size).toBe(uuids.length);
  });

  it("targets a 1920x1080 canvas", () => {
    const collection = buildObsSceneCollection("http://localhost:5173");
    expect(collection.resolution).toEqual({ x: 1920, y: 1080 });
  });

  it("rebuilds every URL against a different origin, e.g. the deployed production domain", () => {
    const collection = buildObsSceneCollection("https://obs-overlay-five.vercel.app");
    const browserSources = (collection.sources as Record<string, unknown>[]).filter((source) => source.id === "browser_source");
    for (const source of browserSources) {
      const url = (source.settings as { url: string }).url;
      expect(url.startsWith("https://obs-overlay-five.vercel.app/")).toBe(true);
    }
  });
});
