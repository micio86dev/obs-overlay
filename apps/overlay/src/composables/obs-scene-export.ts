import { canvasHeight, canvasWidth, overlayPages as pages, type Box } from "./overlay-layout";

// libobs's fixed sentinel UUID for "the default/main canvas" — confirmed against a real OBS Scene
// Collection file (obs-studio/basic/scenes/*.json): every scene in a single-canvas setup carries
// this exact value, not a randomly generated one.
const mainCanvasUuid = "6c69626f-6273-4c00-9d88-c5136d61696e";

// The internal libobs build-version stamp OBS writes onto every source/scene it saves, used to
// decide whether older-format settings need a migration pass on load. Copied verbatim from a real,
// currently-loading OBS scene collection rather than guessed, so nothing here reads as "needs
// migrating from an ancient format".
const obsBuildVersion = 537_001_986;

function relativePosition(box: Box): { x: number; y: number } {
  return { x: (box.x - canvasWidth / 2) / (canvasHeight / 2), y: (box.y - canvasHeight / 2) / (canvasHeight / 2) };
}

function browserSourceHotkeys(): Record<string, unknown[]> {
  return { "libobs.mute": [], "libobs.unmute": [], "libobs.push-to-mute": [], "libobs.push-to-talk": [], "ObsBrowser.Refresh": [] };
}

function browserSource(uuid: string, name: string, url: string, box: Box): Record<string, unknown> {
  return {
    prev_ver: obsBuildVersion,
    name,
    uuid,
    id: "browser_source",
    versioned_id: "browser_source",
    settings: { url, width: box.width, height: box.height, css: "", shutdown: false, restart_when_active: false },
    mixers: 255,
    sync: 0,
    flags: 0,
    volume: 1.0,
    balance: 0.5,
    enabled: true,
    muted: false,
    "push-to-mute": false,
    "push-to-mute-delay": 0,
    "push-to-talk": false,
    "push-to-talk-delay": 0,
    hotkeys: browserSourceHotkeys(),
    deinterlace_mode: 0,
    deinterlace_field_order: 0,
    monitoring_type: 0,
    private_settings: {},
  };
}

function sceneItem(id: number, name: string, sourceUuid: string, box: Box): Record<string, unknown> {
  const pos = { x: box.x, y: box.y };
  const scale = { x: 1, y: 1 };
  return {
    name,
    source_uuid: sourceUuid,
    visible: true,
    locked: false,
    rot: 0,
    scale_ref: { x: canvasWidth, y: canvasHeight },
    align: 5,
    // OBS_BOUNDS_NONE: the item renders at the Browser Source's own settings.width/height, scaled
    // 1:1 — no bounds-box stretching, so the on-screen box is exactly what `box` says it is.
    bounds_type: 0,
    bounds_align: 0,
    bounds_crop: false,
    crop_left: 0,
    crop_top: 0,
    crop_right: 0,
    crop_bottom: 0,
    id,
    group_item_backup: false,
    pos,
    pos_rel: relativePosition(box),
    scale,
    scale_rel: scale,
    bounds: { x: 0, y: 0 },
    bounds_rel: { x: 0, y: 0 },
    scale_filter: "disable",
    blend_method: "default",
    blend_type: "normal",
    show_transition: { duration: 300 },
    hide_transition: { duration: 300 },
    private_settings: {},
  };
}

/**
 * Builds an OBS Studio Scene Collection (the .json format OBS's Scene Collection > Import reads)
 * with one scene containing every overlay page as its own Browser Source, already stacked and
 * sized. Verified against a real OBS scene collection file rather than the format's (unofficial,
 * undocumented) spec, since a subtly wrong hand-written schema would import silently broken rather
 * than fail loudly. Pure and deterministic given `origin` + `uuids` so it stays unit-testable
 * without a real OBS install; `uuids` defaults to crypto.randomUUID, overridable in tests.
 */
export function buildObsSceneCollection(origin: string, uuids: () => string = () => crypto.randomUUID()): Record<string, unknown> {
  const sceneName = "MicioDev Overlay";
  const sceneUuid = uuids();

  const sources = pages.map((page) => browserSource(uuids(), page.name, `${origin}${page.path}`, page.box));
  // Item order is back-to-front (index 0 renders first / furthest back, the last item renders on
  // top) — confirmed against the real scene collection file, not assumed: its own full-overlay
  // browser source is the LAST item in its scene, on top of the capture sources beneath it.
  const items = pages.map((page, index) => sceneItem(index + 1, page.name, sources[index].uuid as string, page.box));

  const scene: Record<string, unknown> = {
    prev_ver: obsBuildVersion,
    name: sceneName,
    uuid: sceneUuid,
    id: "scene",
    versioned_id: "scene",
    settings: { id_counter: pages.length + 1, custom_size: false, items },
    mixers: 255,
    sync: 0,
    flags: 0,
    volume: 1.0,
    balance: 0.5,
    enabled: true,
    muted: false,
    "push-to-mute": false,
    "push-to-mute-delay": 0,
    "push-to-talk": false,
    "push-to-talk-delay": 0,
    hotkeys: browserSourceHotkeys(),
    deinterlace_mode: 0,
    deinterlace_field_order: 0,
    monitoring_type: 0,
    canvas_uuid: mainCanvasUuid,
    private_settings: {},
  };

  return {
    name: sceneName,
    sources: [...sources, scene],
    groups: [],
    scene_order: [{ name: sceneName }],
    current_scene: sceneName,
    current_program_scene: sceneName,
    canvases: [],
    // "Fade" is OBS's own built-in default transition name (always present regardless of what
    // this file lists), not a localized display string — safe across every install's UI language.
    current_transition: "Fade",
    transition_duration: 300,
    transitions: [],
    quick_transitions: [],
    saved_projectors: [],
    preview_locked: false,
    scaling_enabled: false,
    scaling_level: 0,
    scaling_off_x: 0,
    scaling_off_y: 0,
    modules: {},
    resolution: { x: canvasWidth, y: canvasHeight },
    version: 2,
  };
}
