import { describe, expect, it } from "vitest";
import { isDemoMode } from "./useDemoEvents";

describe("isDemoMode", () => {
  it("keeps the zero-configuration demo path enabled unless explicitly disabled", () => {
    expect(isDemoMode(undefined)).toBe(true);
    expect(isDemoMode("true")).toBe(true);
    expect(isDemoMode("false")).toBe(false);
  });
});
