<script setup lang="ts">
import { isDemoMode } from "../composables/useDemoEvents";

// The single generic placement container: the same route is used three times as three separate
// OBS Browser Sources (logo, screen capture, webcam), each sized and positioned by OBS itself to
// exactly cover the real capture source stacked beneath it. Aspect ratio, size, and position are
// therefore OBS's job now, not this component's — it only ever draws a border around whatever box
// OBS gives it, on an otherwise fully transparent page.
const params = new URLSearchParams(window.location.search);
const label = params.get("label") ?? "Placement";
const radius = params.get("radius") === "sm" ? "var(--radius-sm)" : params.get("radius") === "none" ? "0" : "var(--radius-md)";
const demoMode = isDemoMode();
</script>

<template>
  <div
    class="placement-frame"
    :style="{ '--frame-radius': radius }"
    role="img"
    :aria-label="demoMode ? `${label} placement` : undefined"
    :aria-hidden="demoMode ? undefined : 'true'"
  ></div>
</template>

<style scoped>
.placement-frame {
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  border: 1px dashed var(--color-accent-deep);
  border-radius: var(--frame-radius);
  background: transparent;
}
</style>
