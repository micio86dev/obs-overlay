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
