<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import type { ChatModeEvent, OverlayEvent } from "@miciodev/shared-types";
import AlertQueue from "./components/AlertQueue.vue";
import LiveStatusBar from "./components/LiveStatusBar.vue";
import LiveChatFeed from "./components/LiveChatFeed.vue";
import PollHud from "./components/PollHud.vue";
import PythonQuizBoard from "./components/PythonQuizBoard.vue";
import { isDemoMode, useDemoEvents } from "./composables/useDemoEvents";
import { useEventStream } from "./composables/useEventStream";
import { selectVisiblePoll } from "./composables/poll-state";

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
const demo = demoMode ? useDemoEvents(receive) : undefined;
const status = stream?.status ?? computed(() => "DEMO MODE");
const liveState = stream?.liveState ?? demo?.liveState;

// The last chat-mode event is sticky: members-only stays true until YouTube says otherwise.
const chatMode = computed<ChatModeEvent | undefined>(() => events.value.filter((event): event is ChatModeEvent => event.type === "chat-mode").at(-1));

// One shared second-tick drives the poll grace period; no per-component rAF loop.
const now = ref(Date.now());
const clock = setInterval(() => { now.value = Date.now(); }, 1_000);
onBeforeUnmount(() => clearInterval(clock));
const visiblePoll = computed(() => selectVisiblePoll(events.value, now.value));
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
    <PollHud v-if="visiblePoll" :poll="visiblePoll" />
    <LiveStatusBar v-if="liveState" :state="liveState" :demo="demoMode" :chat-mode="chatMode" />
  </main>
</template>

<style scoped>
.overlay { --slot-available-height: calc(100vh - 5rem - 4.5rem); --slot-width: min(100%, calc(var(--slot-available-height) * 16 / 9)); --slot-side-gutter: max(0px, calc((100% - var(--slot-width)) / 2)); position: relative; display: grid; width: 100vw; height: 100vh; padding: var(--space-5); padding-bottom: 4.5rem; isolation: isolate; }
.texture { position: absolute; z-index: -1; top: 0; right: 0; left: 0; height: 7rem; background: linear-gradient(var(--line-color) 1px, transparent 1px), linear-gradient(90deg, var(--line-color) 1px, transparent 1px), linear-gradient(to bottom, var(--color-background), transparent); background-size: 3rem 3rem, 3rem 3rem, auto; mask-image: linear-gradient(to bottom, var(--color-background) 45%, transparent); pointer-events: none; }
.brand { position: absolute; top: var(--space-5); left: var(--space-5); color: var(--color-accent); font-size: clamp(1.2rem, 2vw, 2rem); text-shadow: var(--glow-strong); letter-spacing: .08em; }
.brand span { color: var(--color-text); }
.brand small { margin-left: var(--space-2); color: var(--color-text-muted); font-size: .5em; }
.status-branding { position: absolute; top: var(--space-5); right: var(--space-5); display: flex; align-items: center; gap: var(--space-2); }
.connection { padding: var(--space-1) var(--space-2); color: var(--color-text-muted); border: 1px solid var(--line-color); border-radius: var(--radius-sm); }
.connection.demo { color: var(--color-accent); text-shadow: var(--glow-soft); }
/* Placement slots stay pure alpha so the OBS capture below is fully visible and clipped by these borders. */
.slot, .logo-frame { display: grid; place-items: center; border: 1px dashed var(--color-accent-deep); background: transparent; }
.logo-frame { width: clamp(2.5rem, 5vw, 4rem); aspect-ratio: 1; border-radius: var(--radius-sm); }
.slot { min-width: 0; min-height: 0; border-radius: var(--radius-md); }
/* Capture slots keep a fixed 16:9 box in every layout so an OBS source never overflows its frame. */
.screen-slot, .webcam-slot { align-self: start; justify-self: center; width: var(--slot-width); height: auto; aspect-ratio: 16 / 9; }
.overlay.demo .slot, .overlay.demo .logo-frame { color: var(--color-text-muted); }
.slot span, .logo-frame span { opacity: .45; }
.feed { min-width: 0; align-self: end; }
.alerts { position: absolute; z-index: 2; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.layout-screen-webcam { grid-template-columns: minmax(0, 1fr) minmax(14rem, 24vw); grid-template-rows: minmax(0, 1fr) auto; gap: var(--space-4); padding-top: 5rem; }
.layout-screen-webcam .screen-slot { grid-row: 1 / 3; }
.layout-screen-webcam .feed { grid-column: 2; }
.layout-python-quiz { grid-template-columns: minmax(0, 1fr) minmax(14rem, 24vw); grid-template-rows: minmax(0, 1fr) auto; gap: var(--space-4); padding-top: 5rem; }
.layout-python-quiz .quiz-slot { grid-row: 1 / 3; }
.layout-python-quiz .feed { grid-column: 2; }
.layout-screen-only { grid-template-columns: minmax(16rem, 24vw) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); gap: var(--space-4); padding-top: 5rem; }
.layout-screen-only .feed { grid-column: 1; }
.layout-screen-only .screen-slot { grid-column: 2; }
.layout-webcam-only { grid-template-columns: minmax(0, 1fr) minmax(16rem, 28vw); gap: var(--space-4); padding-top: 5rem; }
.layout-webcam-only .webcam-slot { grid-column: 1; }
.layout-webcam-only .feed { grid-column: 2; }
.layout-screen-camera { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); padding: 5rem var(--space-6) var(--space-6); }
.layout-screen-camera .screen-slot { grid-column: 1; grid-row: 1; }
.layout-screen-camera .feed { position: absolute; z-index: 3; align-self: stretch; top: 5rem; right: calc(var(--space-6) + var(--slot-side-gutter)); bottom: var(--space-6); width: min(24rem, 30vw); min-width: 16rem; }
.layout-screen-camera .feed :deep(.live-chat) { display: flex; height: 100%; flex-direction: column; }
.layout-screen-camera .feed :deep(.messages) { flex: 1; min-height: 0; max-height: none; }
@media (max-width: 700px) { .overlay { --slot-available-height: calc(100vh - 4rem - 3.5rem); padding: var(--space-3); padding-top: 4rem; padding-bottom: 3.5rem; } .layout-screen-webcam, .layout-screen-only, .layout-webcam-only, .layout-python-quiz { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) auto; } .layout-screen-webcam .screen-slot, .layout-screen-webcam .webcam-slot, .layout-screen-webcam .feed, .layout-screen-only .screen-slot, .layout-screen-only .feed, .layout-webcam-only .webcam-slot, .layout-webcam-only .feed, .layout-python-quiz .quiz-slot, .layout-python-quiz .webcam-slot, .layout-python-quiz .feed { grid-column: 1; grid-row: auto; } .brand, .status-branding { top: var(--space-3); } .brand { left: var(--space-3); } .status-branding { right: var(--space-3); } }
@media (max-width: 700px) { .layout-screen-camera { padding: 4rem var(--space-3) var(--space-3); } .layout-screen-camera .feed { top: 4rem; right: calc(var(--space-3) + var(--slot-side-gutter)); bottom: var(--space-3); width: min(20rem, calc(100vw - var(--space-6))); min-width: 0; } }
</style>
