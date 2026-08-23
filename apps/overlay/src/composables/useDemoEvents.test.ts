// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { isDemoMode } from "./useDemoEvents";

function setSearch(search: string): void {
  window.history.pushState({}, "", `/${search}`);
}

describe("isDemoMode", () => {
  afterEach(() => setSearch(""));

  it("follows the build-time value when no override is present", () => {
    expect(isDemoMode("false")).toBe(false);
    expect(isDemoMode("true")).toBe(true);
    expect(isDemoMode(undefined)).toBe(true);
  });

  it("forces demo mode when ?demo=true is present, regardless of the build-time value", () => {
    setSearch("?demo=true");
    expect(isDemoMode("false")).toBe(true);
  });

  it("does not force demo mode for any other ?demo= value", () => {
    setSearch("?demo=1");
    expect(isDemoMode("false")).toBe(false);
    setSearch("?demo=false");
    expect(isDemoMode("false")).toBe(false);
  });
});
