export type PageName = "background" | "navbar" | "footer" | "chat" | "alerts" | "quiz" | "placement" | "preview" | "index";
export const pages: readonly PageName[] = ["background", "navbar", "footer", "chat", "alerts", "quiz", "placement", "preview", "index"];

// The old single-page overlay called this route "game" (and, before that, "python-quiz"); an
// existing Browser Source still pointed at either old name must keep resolving instead of
// silently landing on the index page.
const renamedPages: Readonly<Record<string, PageName>> = { game: "quiz", "python-quiz": "quiz" };

function normalizePageName(value: string): PageName | undefined {
  if (isPageName(value)) return value;
  return renamedPages[value];
}

function isPageName(value: string): value is PageName {
  return (pages as readonly string[]).includes(value);
}

/**
 * Each overlay piece (background, navbar, footer, chat, quiz, the reusable placement frame) is
 * its own route, so each gets its own OBS Browser Source URL. An empty or unrecognized path lands
 * on the index page instead of silently rendering a real overlay piece — a misconfigured Browser
 * Source URL should be obvious, not a blank or wrong-looking layer in the stream.
 */
export function resolvePage(pathname: string): PageName {
  const path = pathname.replace(/^\/+|\/+$/g, "");
  if (path === "") return "index";
  return normalizePageName(path) ?? "index";
}
