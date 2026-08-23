export type LayoutName = "screen-webcam" | "screen-only" | "game";
export const layouts: readonly LayoutName[] = ["screen-webcam", "screen-only", "game"];
const defaultLayout: LayoutName = "screen-webcam";

// "python-quiz" was renamed to "game" (same layout, new name) — an existing Browser Source still
// pointed at the old name must keep resolving instead of silently falling back to the default.
const renamedLayouts: Readonly<Record<string, LayoutName>> = { "python-quiz": "game" };

function normalizeLayoutName(value: string): LayoutName | undefined {
  if (isLayoutName(value)) return value;
  return renamedLayouts[value];
}

function isLayoutName(value: string): value is LayoutName {
  return (layouts as readonly string[]).includes(value);
}

/**
 * Each layout is its own page (e.g. /screen-only) so an OBS Browser Source URL reads cleanly.
 * The legacy ?layout= query string still works — anyone with an existing Browser Source
 * configured that way keeps working — but the path wins when both are present.
 */
export function resolveLayout(pathname: string, search: string): LayoutName {
  const path = pathname.replace(/^\/+|\/+$/g, "");
  const pathLayout = normalizeLayoutName(path);
  if (pathLayout) return pathLayout;
  const queryLayout = new URLSearchParams(search).get("layout");
  const resolvedQueryLayout = queryLayout ? normalizeLayoutName(queryLayout) : undefined;
  if (resolvedQueryLayout) return resolvedQueryLayout;
  return defaultLayout;
}
