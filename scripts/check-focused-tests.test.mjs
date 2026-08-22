import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { findFocusedTestLocations, runFocusedTestGuard } from "./check-focused-tests.mjs";

const testApis = ["test", "it", "describe", "suite", "context", "specify"];

test("rejects .only calls for supported test APIs", () => {
  const source = testApis.map((api) => `${api}.only("focused", () => {});`).join("\n");

  assert.deepEqual(findFocusedTestLocations("fixture.test.ts", source), [
    "fixture.test.ts:1",
    "fixture.test.ts:2",
    "fixture.test.ts:3",
    "fixture.test.ts:4",
    "fixture.test.ts:5",
    "fixture.test.ts:6"
  ]);
});

test("rejects calls chained from .only", () => {
  const source = [
    'test.only.each([[1]])("focused", () => {});',
    'it.only.concurrent("focused", () => {});',
    'describe.only.skip("focused", () => {});'
  ].join("\n");

  assert.deepEqual(findFocusedTestLocations("fixture.test.ts", source), [
    "fixture.test.ts:1",
    "fixture.test.ts:2",
    "fixture.test.ts:3"
  ]);
});

test("rejects only: true options for supported test APIs", () => {
  const source = testApis
    .map((api) => `${api}("focused", { only: true }, () => {});`)
    .join("\n");

  assert.deepEqual(findFocusedTestLocations("fixture.test.ts", source), [
    "fixture.test.ts:1",
    "fixture.test.ts:2",
    "fixture.test.ts:3",
    "fixture.test.ts:4",
    "fixture.test.ts:5",
    "fixture.test.ts:6"
  ]);
});

test("does not treat comments and string literals as focused tests", () => {
  const source = [
    "// test.only(\"comment\", () => {});",
    "/* it(\"comment\", { only: true }, () => {}); */",
    "const example = \"describe.only('literal', () => {})\";",
    "const options = { only: true };",
    "test(\"allowed\", options, () => {});",
    "test(\"allowed\", { only: false }, () => {});"
  ].join("\n");

  assert.deepEqual(findFocusedTestLocations("fixture.test.ts", source), []);
});

test("CLI guard recursively reports executable focused tests from an injected root", (context) => {
  const root = mkdtempSync(join(tmpdir(), "focused-test-guard-"));
  const fixturePath = join(root, "apps", "nested", "fixture.test.ts");
  const diagnostics = [];

  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "apps", "nested"), { recursive: true });
  writeFileSync(
    fixturePath,
    [
      '// test.only("comment", () => {});',
      "const literal = 'test.only(\"literal\", () => {})';",
      "",
      'test.only.each([[1]])("focused", () => {});'
    ].join("\n")
  );

  const exitCode = runFocusedTestGuard({
    root,
    writeError: (message) => diagnostics.push(message)
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(diagnostics, [
    "Focused tests are not allowed. Remove .only and only: true before running the test suite:",
    "  apps/nested/fixture.test.ts:4"
  ]);
});

test("CLI executable exits nonzero for a focused test fixture", (context) => {
  const root = mkdtempSync(join(tmpdir(), "focused-test-guard-process-"));
  const fixturePath = join(root, "apps", "nested", "fixture.test.ts");
  const guardPath = join(process.cwd(), "scripts", "check-focused-tests.mjs");

  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "apps", "nested"), { recursive: true });
  writeFileSync(fixturePath, 'test.only.each([[1]])("focused", () => {});\n');

  const result = spawnSync(process.execPath, [guardPath], {
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "test", FOCUSED_TEST_GUARD_ROOT: root }
  });

  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "Focused tests are not allowed. Remove .only and only: true before running the test suite:\n" +
      "  apps/nested/fixture.test.ts:1\n"
  );
});
