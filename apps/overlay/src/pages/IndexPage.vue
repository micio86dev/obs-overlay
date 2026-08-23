<script setup lang="ts">
// Not an OBS source: a plain human-facing page for wiring up Browser Sources, reached only by
// opening the app root directly (or an unrecognized path) in a normal browser tab.
import { buildObsSceneCollection } from "../composables/obs-scene-export";

const routes = [
  { path: "/background", desc: "Full-bleed grid background. Put this at the bottom of the scene." },
  { path: "/navbar", desc: "Brand, live badge, and connection status (top corners)." },
  { path: "/footer", desc: "Viewer/revenue/member stats bar (bottom)." },
  { path: "/chat", desc: "Live chat panel." },
  { path: "/alerts", desc: "Alert queue, floating reactions, and the poll HUD." },
  { path: "/quiz", desc: "Python quiz board." },
  { path: "/placement?label=Screen&radius=md", desc: "Generic placement frame — add once per capture source (logo, screen, webcam), sized/positioned in OBS." },
];

// A Scene Collection made only of Browser Sources is identical across Windows, macOS, and Linux —
// unlike a Display Capture or webcam source, browser_source's OBS plugin id never varies by OS —
// so one download covers every platform instead of needing an OS picker.
function downloadObsSceneCollection(): void {
  const collection = buildObsSceneCollection(window.location.origin);
  const blob = new Blob([JSON.stringify(collection, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "MicioDev_Overlay.json";
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <main class="index">
    <h1>MicioDev OBS Overlay</h1>
    <p>Each row below is its own OBS Browser Source. See the README for full setup and z-order guidance.</p>

    <section class="export">
      <button type="button" @click="downloadObsSceneCollection">Download OBS scene collection</button>
      <p>One <code>.json</code> file, ready for OBS's Scene Collection → Import. It adds every page below as its own Browser Source, already stacked and sized on a 1920×1080 canvas — you still add your own Display Capture and webcam sources and drag the three placement frames to line up with them. Works on Windows, macOS, and Linux alike.</p>
    </section>

    <section class="export">
      <a class="button" href="/preview">Preview the full layout</a>
      <p>Every page above composed together on that same 1920×1080 canvas, scaled to fit this window, with demo mode forced on — so you can see the whole design with fake chat, alerts, and stats without opening OBS at all.</p>
    </section>

    <ul>
      <li v-for="route in routes" :key="route.path">
        <a :href="route.path">{{ route.path }}</a>
        <p>{{ route.desc }}</p>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.index { max-width: 40rem; margin: 0 auto; padding: var(--space-6) var(--space-4); color: var(--color-text); background: var(--color-background); }
h1 { color: var(--color-accent); }
.export { padding: var(--space-4); margin: var(--space-5) 0; border: 1px solid var(--line-color); border-radius: var(--radius-md); background: var(--color-surface-transparent); }
.export p { margin-top: var(--space-2); }
button, .button { display: inline-block; padding: var(--space-2) var(--space-4); color: var(--color-background); border: 0; border-radius: var(--radius-sm); background: var(--color-accent); font-weight: var(--font-weight); text-decoration: none; cursor: pointer; }
button:hover, .button:hover { background: var(--color-accent-bright); }
code { color: var(--color-accent-bright); }
ul { display: grid; gap: var(--space-4); padding: 0; list-style: none; }
ul a { color: var(--color-accent-bright); font-weight: var(--font-weight); }
p { margin: var(--space-1) 0 0; color: var(--color-text-muted); }
</style>
