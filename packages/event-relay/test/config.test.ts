import assert from "node:assert/strict";
import test from "node:test";
import { parseBoundedInteger } from "../src/config.ts";

test("parseBoundedInteger uses its fallback only for an unset value", () => {
  assert.equal(parseBoundedInteger(undefined, { name: "PORT", fallback: 8787, minimum: 1, maximum: 65_535 }), 8787);
  assert.equal(parseBoundedInteger("8080", { name: "PORT", fallback: 8787, minimum: 1, maximum: 65_535 }), 8080);
});

test("parseBoundedInteger fails fast for malformed and out-of-range environment values", () => {
  const options = { name: "MOCK_INTERVAL_MS", fallback: 8_000, minimum: 1_000, maximum: 60_000 };

  for (const value of ["", "Infinity", "NaN", "1.5", "999", "60001"]) {
    assert.throws(() => parseBoundedInteger(value, options), /MOCK_INTERVAL_MS must be an integer/);
  }
});
