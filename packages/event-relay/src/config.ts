import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface BoundedIntegerOptions {
  name: string;
  fallback: number;
  minimum: number;
  maximum: number;
}

/**
 * Reads an optional numeric environment variable without allowing values that
 * would make server binding or timers unpredictable.
 */
export function parseBoundedInteger(value: string | undefined, options: BoundedIntegerOptions): number {
  if (value === undefined) return options.fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < options.minimum || parsed > options.maximum) {
    throw new Error(`${options.name} must be an integer between ${options.minimum} and ${options.maximum}.`);
  }
  return parsed;
}

/** Reads a local .env before any source is selected, without adding a dependency. */
export function loadDotenv(directory = process.cwd()): void {
  const file = resolve(directory, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}
