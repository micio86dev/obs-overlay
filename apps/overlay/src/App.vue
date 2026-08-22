<script setup lang="ts">
import { computed, ref } from "vue";
import type { OverlayEvent } from "@miciodev/shared-types";
import AlertQueue from "./components/AlertQueue.vue";
import LiveChatFeed from "./components/LiveChatFeed.vue";
import PythonQuizBoard from "./components/PythonQuizBoard.vue";
import { isDemoMode, useDemoEvents } from "./composables/useDemoEvents";
import { useEventStream } from "./composables/useEventStream";

type LayoutName = "screen-webcam" | "screen-only" | "webcam-only" | "screen-camera" | "python-quiz";
const layouts: LayoutName[] = ["screen-webcam", "screen-only", "webcam-only", "screen-camera", "python-quiz"];
const requestedLayout = new URLSearchParams(window.location.search).get("layout");
const layout: LayoutName = layouts.includes(requestedLayout as LayoutName) ? requestedLayout as LayoutName : "screen-webcam";
const events = ref<OverlayEvent[]>([]);

function receive(event: OverlayEvent): void {
  if (events.value.some((item) => item.id === event.id)) return;
  events.value = [...events.value, event].slice(-30);
}

const demoMode = isDemoMode();
const stream = demoMode ? undefined : useEventStream(receive);
if (demoMode) useDemoEvents(receive);
const status = stream?.status ?? computed(() => "DEMO MODE");
</script>

<template>
  <main class="overlay" :class="[`layout-${layout}`, { demo: demoMode }]">
    <div class="texture" aria-hidden="true"></div>
    <header class="brand"><span>MICIO</span>DEV <small>ISCRIVITI CAGNACCIO!</small></header>
    <div class="status-branding">
      <aside class="connection" :class="{ demo: demoMode }">{{ demoMode ? "DEMO MODE" : status }}</aside>
      <div class="logo-frame" role="img" aria-label="Logo placement"><span v-if="demoMode">LOGO</span></div>
    </div>
    <PythonQuizBoard v-if="layout === 'python-quiz'" class="quiz-slot" :events="events" />
    <section v-else-if="layout !== 'webcam-only'" class="slot screen-slot" data-placement-frame="screen" :aria-hidden="demoMode ? undefined : 'true'" :aria-label="demoMode ? 'Screen capture placement' : undefined"><span v-if="demoMode">SCREEN CAPTURE</span></section>
    <section v-if="layout !== 'screen-only' && layout !== 'screen-camera'" class="slot webcam-slot" data-placement-frame="webcam" :aria-hidden="demoMode ? undefined : 'true'" :aria-label="demoMode ? 'Webcam placement' : undefined"><span v-if="demoMode">WEBCAM</span></section>
    <div class="feed"><LiveChatFeed :events="events" /></div>
    <div class="alerts"><AlertQueue :events="events" /></div>
  </main>
</template>

<style scoped>
.overlay { position: relative; display: grid; width: 100vw; height: 100vh; padding: var(--space-5); isolation: isolate; }
.texture { position: absolute; inset: 0; z-index: -1; background: linear-gradient(var(--line-color) 1px, transparent 1px), linear-gradient(90deg, var(--line-color) 1px, transparent 1px), radial-gradient(circle at 50% 0%, var(--color-surface), var(--color-background) 60%); background-size: 3rem 3rem, 3rem 3rem, auto; mask-image: linear-gradient(to bottom, transparent, var(--color-background) 18%, var(--color-background)); }
.brand { position: absolute; top: var(--space-5); left: var(--space-5); color: var(--color-accent); font-size: clamp(1.2rem, 2vw, 2rem); text-shadow: var(--glow-strong); letter-spacing: .08em; }
.brand span { color: var(--color-text); }
.brand small { margin-left: var(--space-2); color: var(--color-text-muted); font-size: .5em; }
.status-branding { position: absolute; top: var(--space-5); right: var(--space-5); display: flex; align-items: center; gap: var(--space-2); }
.connection { padding: var(--space-1) var(--space-2); color: var(--color-text-muted); border: 1px solid var(--line-color); border-radius: var(--radius-sm); }
.connection.demo { color: var(--color-accent); text-shadow: var(--glow-soft); }
.slot, .logo-frame { display: grid; place-items: center; border: 1px dashed var(--color-accent-deep); background: transparent; }
.logo-frame { width: clamp(2.5rem, 5vw, 4rem); aspect-ratio: 1; border-radius: var(--radius-sm); }
.slot { min-width: 0; min-height: 0; border-radius: var(--radius-md); }
.overlay.demo .slot, .overlay.demo .logo-frame { color: var(--color-text-muted); }
.slot span, .logo-frame span { opacity: .45; }
.feed { min-width: 0; align-self: end; }
.alerts { position: absolute; z-index: 2; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.layout-screen-webcam { grid-template-columns: minmax(0, 1fr) minmax(14rem, 24vw); grid-template-rows: minmax(0, 1fr) auto; gap: var(--space-4); padding-top: 5rem; }
.layout-screen-webcam .screen-slot { grid-row: 1 / 3; }
.layout-screen-webcam .webcam-slot { min-height: 28vh; }
.layout-screen-webcam .feed { grid-column: 2; }
.layout-python-quiz { grid-template-columns: minmax(0, 1fr) minmax(14rem, 24vw); grid-template-rows: minmax(0, 1fr) auto; gap: var(--space-4); padding-top: 5rem; }
.layout-python-quiz .quiz-slot { grid-row: 1 / 3; }
.layout-python-quiz .webcam-slot { min-height: 28vh; }
.layout-python-quiz .feed { grid-column: 2; }
.layout-screen-only { grid-template-columns: minmax(16rem, 24vw) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); gap: var(--space-4); padding-top: 5rem; }
.layout-screen-only .feed { grid-column: 1; }
.layout-screen-only .screen-slot { grid-column: 2; }
.layout-webcam-only { grid-template-columns: minmax(0, 1fr) minmax(16rem, 28vw); gap: var(--space-4); padding-top: 5rem; }
.layout-webcam-only .webcam-slot { grid-column: 1; }
.layout-webcam-only .feed { grid-column: 2; }
.layout-screen-camera { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); padding: 5rem var(--space-6) var(--space-6); }
.layout-screen-camera .screen-slot { grid-column: 1; grid-row: 1; }
.layout-screen-camera .feed { position: absolute; z-index: 3; top: 5rem; right: var(--space-6); bottom: var(--space-6); width: min(24rem, 30vw); min-width: 16rem; }
.layout-screen-camera .feed :deep(.live-chat) { display: flex; height: 100%; flex-direction: column; }
.layout-screen-camera .feed :deep(.messages) { flex: 1; min-height: 0; max-height: none; }
@media (max-width: 700px) { .overlay { padding: var(--space-3); padding-top: 4rem; } .layout-screen-webcam, .layout-screen-only, .layout-webcam-only, .layout-python-quiz { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) auto; } .layout-screen-webcam .screen-slot, .layout-screen-webcam .webcam-slot, .layout-screen-webcam .feed, .layout-screen-only .screen-slot, .layout-screen-only .feed, .layout-webcam-only .webcam-slot, .layout-webcam-only .feed, .layout-python-quiz .quiz-slot, .layout-python-quiz .webcam-slot, .layout-python-quiz .feed { grid-column: 1; grid-row: auto; } .brand, .status-branding { top: var(--space-3); } .brand { left: var(--space-3); } .status-branding { right: var(--space-3); } }
@media (max-width: 700px) { .layout-screen-camera { padding: 4rem var(--space-3) var(--space-3); } .layout-screen-camera .feed { top: 4rem; right: var(--space-3); bottom: var(--space-3); width: min(20rem, calc(100vw - var(--space-6))); min-width: 0; } }
</style>
