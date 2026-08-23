import { describe, expect, it } from "vitest";
import { resolveLayout } from "./resolve-layout";

describe("resolveLayout", () => {
  it("resolves a known layout from the path", () => {
    expect(resolveLayout("/screen-only", "")).toBe("screen-only");
    expect(resolveLayout("/game/", "")).toBe("game");
  });

  it("falls back to the legacy ?layout= query string when the path is not a known layout", () => {
    expect(resolveLayout("/", "?layout=game")).toBe("game");
    expect(resolveLayout("", "?layout=screen-only")).toBe("screen-only");
  });

  it("prefers the path over the query string when both are present", () => {
    expect(resolveLayout("/screen-only", "?layout=game")).toBe("screen-only");
  });

  it("defaults to screen-webcam for an empty, unknown, or invalid path and query", () => {
    expect(resolveLayout("/", "")).toBe("screen-webcam");
    expect(resolveLayout("/not-a-layout", "")).toBe("screen-webcam");
    expect(resolveLayout("/", "?layout=not-a-layout")).toBe("screen-webcam");
  });

  it("resolves the renamed python-quiz layout to game, from both the path and the query string", () => {
    expect(resolveLayout("/python-quiz", "")).toBe("game");
    expect(resolveLayout("/", "?layout=python-quiz")).toBe("game");
  });
});
