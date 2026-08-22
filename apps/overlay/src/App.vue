<script setup lang="ts">
import { computed, ref } from "vue";
import type { OverlayEvent } from "@miciodev/shared-types";
import AlertQueue from "./components/AlertQueue.vue";
import LiveChatFeed from "./components/LiveChatFeed.vue";
import { isDemoMode, useDemoEvents } from "./composables/useDemoEvents";
import { useEventStream } from "./composables/useEventStream";

type LayoutName = "screen-webcam" | "screen-only" | "webcam-only";
const layouts: LayoutName[] = ["screen-webcam", "screen-only", "webcam-only"];
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
const layoutTitle = computed(() => layout.replaceAll("-", " · ").toUpperCase());
</script>

<template>
  <main class="overlay" :class="`layout-${layout}`">
    <div class="texture" aria-hidden="true"></div>
    <header class="brand"><span>MICIO</span>DEV <small>{{ layoutTitle }}</small></header>
    <aside class="connection" :class="{ demo: demoMode }">{{ demoMode ? "DEMO MODE" : status }}</aside>
    <section v-if="layout !== 'webcam-only'" class="slot screen-slot" aria-label="Screen capture placement"><span>SCREEN CAPTURE</span></section>
    <section v-if="layout !== 'screen-only'" class="slot webcam-slot" aria-label="Webcam placement"><span>WEBCAM</span></section>
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
.connection { position: absolute; top: var(--space-5); right: var(--space-5); padding: var(--space-1) var(--space-2); color: var(--color-text-muted); border: 1px solid var(--line-color); border-radius: var(--radius-sm); }
.connection.demo { color: var(--color-accent); text-shadow: var(--glow-soft); }
.slot { display: grid; place-items: center; min-width: 0; min-height: 0; border: 1px dashed var(--color-accent-deep); border-radius: var(--radius-md); color: var(--color-text-muted); background: var(--color-surface-transparent); }
.slot span { opacity: .45; }
.feed { min-width: 0; align-self: end; }
.alerts { position: absolute; z-index: 2; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.layout-screen-webcam { grid-template-columns: minmax(0, 1fr) minmax(14rem, 24vw); grid-template-rows: minmax(0, 1fr) auto; gap: var(--space-4); padding-top: 5rem; }
.layout-screen-webcam .screen-slot { grid-row: 1 / 3; }
.layout-screen-webcam .webcam-slot { min-height: 28vh; }
.layout-screen-webcam .feed { grid-column: 2; }
.layout-screen-only { grid-template-columns: minmax(16rem, 24vw) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); gap: var(--space-4); padding-top: 5rem; }
.layout-screen-only .feed { grid-column: 1; }
.layout-screen-only .screen-slot { grid-column: 2; }
.layout-webcam-only { grid-template-columns: minmax(0, 1fr) minmax(16rem, 28vw); gap: var(--space-4); padding-top: 5rem; }
.layout-webcam-only .webcam-slot { grid-column: 1; }
.layout-webcam-only .feed { grid-column: 2; }
@media (max-width: 700px) { .overlay { padding: var(--space-3); padding-top: 4rem; } .layout-screen-webcam, .layout-screen-only, .layout-webcam-only { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) auto; } .layout-screen-webcam .screen-slot, .layout-screen-webcam .webcam-slot, .layout-screen-webcam .feed, .layout-screen-only .screen-slot, .layout-screen-only .feed, .layout-webcam-only .webcam-slot, .layout-webcam-only .feed { grid-column: 1; grid-row: auto; } .brand { top: var(--space-3); left: var(--space-3); } .connection { top: var(--space-3); right: var(--space-3); } }
</style>
