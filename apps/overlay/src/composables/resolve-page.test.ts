import { describe, expect, it } from "vitest";
import { resolvePage } from "./resolve-page";

describe("resolvePage", () => {
  it("resolves a known page from the path", () => {
    expect(resolvePage("/background")).toBe("background");
    expect(resolvePage("/navbar")).toBe("navbar");
    expect(resolvePage("/footer")).toBe("footer");
    expect(resolvePage("/chat")).toBe("chat");
    expect(resolvePage("/alerts")).toBe("alerts");
    expect(resolvePage("/quiz")).toBe("quiz");
    expect(resolvePage("/placement")).toBe("placement");
    expect(resolvePage("/preview")).toBe("preview");
  });

  it("ignores leading and trailing slashes", () => {
    expect(resolvePage("/quiz/")).toBe("quiz");
  });

  it("resolves the renamed game and python-quiz paths to quiz", () => {
    expect(resolvePage("/game")).toBe("quiz");
    expect(resolvePage("/python-quiz")).toBe("quiz");
  });

  it("falls back to the index page for an empty or unrecognized path", () => {
    expect(resolvePage("/")).toBe("index");
    expect(resolvePage("")).toBe("index");
    expect(resolvePage("/not-a-page")).toBe("index");
  });
});
