<script setup lang="ts">
// Not an OBS source: a plain human-facing page for wiring up Browser Sources, reached only by
// opening the app root directly (or an unrecognized path) in a normal browser tab.
const routes = [
  { path: "/background", desc: "Full-bleed grid background. Put this at the bottom of the scene." },
  { path: "/navbar", desc: "Brand, live badge, and connection status (top corners)." },
  { path: "/footer", desc: "Viewer/revenue/member stats bar (bottom)." },
  { path: "/chat", desc: "Live chat panel." },
  { path: "/alerts", desc: "Alert queue, floating reactions, and the poll HUD." },
  { path: "/quiz", desc: "Python quiz board." },
  { path: "/placement?label=Screen&radius=md", desc: "Generic placement frame — add once per capture source (logo, screen, webcam), sized/positioned in OBS." },
];
</script>

<template>
  <main class="index">
    <h1>MicioDev OBS Overlay</h1>
    <p>Each row below is its own OBS Browser Source. See the README for full setup and z-order guidance.</p>
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
ul { display: grid; gap: var(--space-4); padding: 0; list-style: none; }
a { color: var(--color-accent-bright); font-weight: var(--font-weight); }
p { margin: var(--space-1) 0 0; color: var(--color-text-muted); }
</style>
