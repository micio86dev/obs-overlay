<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { canvasHeight, canvasWidth, overlayPages } from "../composables/overlay-layout";

// A composite view for a normal browser tab, not an OBS source: every overlay page embedded at
// its real OBS scene position/size (see overlay-layout.ts), scaled to fit the viewport, so the
// whole design can be reviewed without opening OBS. Forces demo mode via ?demo=true on every
// embedded page regardless of how this deploy is configured — see isDemoMode in useDemoEvents.ts.
const scale = ref(1);
const margin = 32;

function updateScale(): void {
  const availableWidth = window.innerWidth - margin * 2;
  const availableHeight = window.innerHeight - margin * 2;
  scale.value = Math.min(availableWidth / canvasWidth, availableHeight / canvasHeight, 1);
}

function frameSrc(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}demo=true`;
}

onMounted(() => {
  updateScale();
  window.addEventListener("resize", updateScale);
});
onBeforeUnmount(() => window.removeEventListener("resize", updateScale));
</script>

<template>
  <main class="preview">
    <div class="canvas" :style="{ width: `${canvasWidth}px`, height: `${canvasHeight}px`, transform: `scale(${scale})` }">
      <iframe
        v-for="page in overlayPages"
        :key="page.path"
        :src="frameSrc(page.path)"
        :title="page.name"
        :style="{ left: `${page.box.x}px`, top: `${page.box.y}px`, width: `${page.box.width}px`, height: `${page.box.height}px` }"
      ></iframe>
    </div>
  </main>
</template>

<style scoped>
.preview { display: grid; place-items: center; width: 100vw; height: 100vh; overflow: hidden; background: var(--color-background); }
.canvas { position: relative; flex: none; transform-origin: center; }
iframe { position: absolute; border: 0; background: transparent; }
</style>
