export const canvasWidth = 1920;
export const canvasHeight = 1080;

export interface Box { x: number; y: number; width: number; height: number }

export interface OverlayPage {
  /** Scene item / source name, shown in OBS's Sources panel and as the preview iframe's title. */
  name: string;
  /** Path (with query string) appended to the current origin to build the Browser Source URL. */
  path: string;
  box: Box;
}

// One shared overlay scene, back to front: background first, alerts last (nothing should ever be
// hidden behind a floating alert or reaction). Screen/webcam/logo placement frames sit between the
// background and the HUD chrome, matching where a streamer's own Display Capture and webcam
// sources belong in the stack. The single source of truth for both the OBS scene collection export
// (obs-scene-export.ts) and the in-browser composite preview (PreviewPage.vue) — they must never
// drift apart, or the preview would show something the exported scene doesn't actually build.
export const overlayPages: readonly OverlayPage[] = [
  { name: "Background", path: "/background", box: { x: 0, y: 0, width: canvasWidth, height: canvasHeight } },
  { name: "Placement — Screen", path: "/placement?label=Screen&radius=md", box: { x: 40, y: 120, width: 900, height: 563 } },
  { name: "Placement — Webcam", path: "/placement?label=Webcam&radius=md", box: { x: 1500, y: 120, width: 380, height: 214 } },
  { name: "Placement — Logo", path: "/placement?label=Logo&radius=sm", box: { x: 1810, y: 20, width: 90, height: 90 } },
  { name: "Navbar", path: "/navbar", box: { x: 0, y: 0, width: canvasWidth, height: canvasHeight } },
  { name: "Footer", path: "/footer", box: { x: 0, y: 0, width: canvasWidth, height: canvasHeight } },
  { name: "Chat", path: "/chat", box: { x: 1450, y: 360, width: 430, height: 600 } },
  { name: "Alerts", path: "/alerts", box: { x: 0, y: 0, width: canvasWidth, height: canvasHeight } },
];
