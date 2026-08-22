import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import ts from "typescript";

const testFilePattern = /(?:\.(?:test|spec|pw)\.[cm]?[jt]sx?$|\/(?:test|tests)\/.*\.[cm]?[jt]sx?$)/;
const testApiNames = new Set(["test", "it", "describe", "suite", "context", "specify"]);
const ignoredDirectories = new Set(["node_modules", "dist", "coverage"]);
const sourceDirectories = ["apps", "packages", "scripts"];

function testFilesIn(directoryPath) {
  if (!existsSync(directoryPath)) {
    return [];
  }

  return readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) ? [] : testFilesIn(entryPath);
    }

    return entry.isFile() && testFilePattern.test(entryPath) ? [entryPath] : [];
  });
}

function scriptKindFor(filePath) {
  if (filePath.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }

  if (filePath.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }

  if (filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }

  return ts.ScriptKind.TS;
}

function unwrapExpression(expression) {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return unwrapExpression(expression.expression);
  }

  return expression;
}

function propertyNameText(propertyName) {
  if (ts.isIdentifier(propertyName) || ts.isStringLiteral(propertyName)) {
    return propertyName.text;
  }

  if (ts.isComputedPropertyName(propertyName) && ts.isStringLiteral(propertyName.expression)) {
    return propertyName.expression.text;
  }

  return undefined;
}

function isTestApi(expression) {
  return ts.isIdentifier(expression) && testApiNames.has(expression.text);
}

function isOnlyPropertyAccess(expression) {
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text === "only" && isTestApi(expression.expression);
  }

  return (
    ts.isElementAccessExpression(expression) &&
    expression.argumentExpression !== undefined &&
    ts.isStringLiteral(expression.argumentExpression) &&
    expression.argumentExpression.text === "only" &&
    isTestApi(expression.expression)
  );
}

function isDerivedFromFocusedMember(expression) {
  const baseExpression = unwrapExpression(expression);

  if (isOnlyPropertyAccess(baseExpression)) {
    return true;
  }

  if (
    ts.isCallExpression(baseExpression) ||
    ts.isPropertyAccessExpression(baseExpression) ||
    ts.isElementAccessExpression(baseExpression)
  ) {
    return isDerivedFromFocusedMember(baseExpression.expression);
  }

  return false;
}

function isTrueExpression(expression) {
  return unwrapExpression(expression).kind === ts.SyntaxKind.TrueKeyword;
}

function hasOnlyTrueOption(expression) {
  const options = unwrapExpression(expression);

  return (
    ts.isObjectLiteralExpression(options) &&
    options.properties.some(
      (property) =>
        ts.isPropertyAssignment(property) &&
        propertyNameText(property.name) === "only" &&
        isTrueExpression(property.initializer)
    )
  );
}

function isFocusedTestCall(call) {
  return (
    isDerivedFromFocusedMember(call.expression) ||
    (isTestApi(call.expression) && call.arguments.some(hasOnlyTrueOption))
  );
}

export function findFocusedTestLocations(filePath, source) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    false,
    scriptKindFor(filePath)
  );
  const locations = [];

  function visit(node) {
    if (ts.isCallExpression(node) && isFocusedTestCall(node)) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      locations.push(`${filePath}:${position.line + 1}`);
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return locations;
}

function focusedTestLocations(root, filePath) {
  return findFocusedTestLocations(relative(root, filePath), readFileSync(filePath, "utf8"));
}

export function runFocusedTestGuard({ root = process.cwd(), writeError = console.error } = {}) {
  const resolvedRoot = resolve(root);
  const locations = sourceDirectories
    .flatMap((directoryPath) => testFilesIn(join(resolvedRoot, directoryPath)))
    .flatMap((filePath) => focusedTestLocations(resolvedRoot, filePath));

  if (locations.length === 0) {
    return 0;
  }

  writeError("Focused tests are not allowed. Remove .only and only: true before running the test suite:");
  for (const location of locations) {
    writeError(`  ${location}`);
  }
  return 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = process.env.NODE_ENV === "test" ? process.env.FOCUSED_TEST_GUARD_ROOT : undefined;
  process.exitCode = runFocusedTestGuard({ root });
}
