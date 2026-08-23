<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import type { ChatModeEvent, OverlayEvent } from "@miciodev/shared-types";
import AlertQueue from "./components/AlertQueue.vue";
import LiveIdentityBadge from "./components/LiveIdentityBadge.vue";
import LiveStatusBar from "./components/LiveStatusBar.vue";
import LiveChatFeed from "./components/LiveChatFeed.vue";
import PollHud from "./components/PollHud.vue";
import PythonQuizBoard from "./components/PythonQuizBoard.vue";
import ReactionBurst from "./components/ReactionBurst.vue";
import { isDemoMode, useDemoEvents } from "./composables/useDemoEvents";
import { useEventStream } from "./composables/useEventStream";
import { selectVisiblePoll } from "./composables/poll-state";
import { resolveLayout } from "./composables/resolve-layout";

const layout = resolveLayout(window.location.pathname, window.location.search);
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
    <div class="padding-frame" aria-hidden="true"></div>
    <div class="texture" aria-hidden="true"></div>
    <header class="brand"><span>MICIO</span>DEV <small>ISCRIVITI CAGNACCIO!</small></header>
    <div class="status-branding">
      <LiveIdentityBadge v-if="liveState" :state="liveState" :demo="demoMode" />
      <aside class="connection" :class="{ demo: demoMode }">{{ demoMode ? "DEMO MODE" : status }}</aside>
      <div class="logo-frame" role="img" aria-label="Logo placement"></div>
    </div>
    <PythonQuizBoard v-if="layout === 'game'" class="quiz-slot" :events="events" />
    <div v-else class="slot-frame screen-frame">
      <div class="slot-grid" aria-hidden="true"></div>
      <section class="slot screen-slot" data-placement-frame="screen" :aria-hidden="demoMode ? undefined : 'true'" :aria-label="demoMode ? 'Screen capture placement' : undefined"></section>
    </div>
    <div v-if="layout !== 'screen-only'" class="slot-frame webcam-frame">
      <div class="slot-grid" aria-hidden="true"></div>
      <section class="slot webcam-slot" data-placement-frame="webcam" :aria-hidden="demoMode ? undefined : 'true'" :aria-label="demoMode ? 'Webcam placement' : undefined"></section>
    </div>
    <div class="feed"><LiveChatFeed :events="events" /></div>
    <div class="alerts"><AlertQueue :events="events" /></div>
    <ReactionBurst :events="events" />
    <PollHud v-if="visiblePoll" :poll="visiblePoll" />
    <LiveStatusBar v-if="liveState" :state="liveState" :chat-mode="chatMode" />
  </main>
</template>

<style scoped>
/* Every length below is vw/vh/rem-based on purpose, never a bare "%": mask-size resolves a
   percentage against the AXIS it sits in (width-slot -> element width, height-slot -> element
   height), so a width value carrying a bare "%" silently turns into the wrong axis the moment
   it's reused inside a height calc(). vw/vh/rem have no such per-axis reinterpretation, so
   --screen-w can safely feed a height calc() without corrupting the mask hole. */
.overlay {
  --pad-top: 5rem; --pad-x: var(--space-5); --pad-bottom: 4.5rem;
  --content-top: var(--pad-top); --content-right: var(--space-5);
  --content-w: calc(100vw - var(--pad-x) * 2); --content-h: calc(100vh - var(--pad-top) - var(--pad-bottom));
  --side-col-w: clamp(14rem, 24vw, 24rem);
  --two-col-w: calc(var(--content-w) - var(--side-col-w) - var(--space-4));
  /* The screen-share box targets 16:10 (1.6:1), between broadcast-standard 16:9 (1.78:1) and a
     MacBook's actual panel ratio, instead of 16:9: a 16:9 box letterboxes a laptop screen capture,
     since MacBook panels are taller than 16:9. The webcam box stays 16:9 on purpose — webcams are
     standard 16:9 regardless of what laptop panel is being screen-shared. */
  --screen-only-w: min(var(--content-w), calc(var(--content-h) * 16 / 10));
  --split-w: min(var(--two-col-w), calc(var(--content-h) * 16 / 10));
  --webcam-w: min(var(--side-col-w), calc(var(--content-h) * 16 / 9));
  --webcam-h: calc(var(--webcam-w) * 9 / 16);
  --screen-side-gutter: max(0px, calc((var(--content-w) - var(--screen-only-w)) / 2));
  /* Clamp max is 3.5rem (56px), not a round 4rem: the header band is content-top(5rem=80px) minus
     logo-inset(space-5=24px) = 56px of real headroom above the content box. A logo-size max of
     4rem(64px) overflows that by 8px at any viewport wide enough to hit the clamp's ceiling (e.g.
     1920px desktop) — the guide box's own bottom border then visibly sits inside the screen/webcam
     capture box below it instead of staying in the header strip. */
  --logo-size: clamp(2.5rem, 5vw, 3.5rem); --logo-inset: var(--space-5);
  position: relative; display: grid; width: 100vw; height: 100vh;
  padding: var(--pad-top) var(--pad-x) var(--pad-bottom); isolation: isolate;
}
.layout-screen-webcam { --screen-w: var(--split-w); --screen-h: calc(var(--split-w) * 10 / 16); }
.layout-screen-only { --screen-w: var(--screen-only-w); --screen-h: calc(var(--screen-only-w) * 10 / 16); }
/* The grid pattern paints everywhere in the padding band EXCEPT the content box: two mask
   layers (full rect, content-box rect) combine with "exclude" to cut that hole, so the grid
   never has to know which layout is active — it only needs the padding thickness. The content
   box interior itself stays fully see-through (no background at all) except right around each
   placement slot, where .slot-frame below paints its own local copy of this same pattern —
   everything else in the interior (gaps, the area behind chat, etc.) must stay real alpha so
   OBS sources placed under this browser source are never occluded by decoration. */
.padding-frame {
  position: absolute; inset: 0; z-index: -2; pointer-events: none;
  background: linear-gradient(var(--line-color) 1px, transparent 1px), linear-gradient(90deg, var(--line-color) 1px, transparent 1px), var(--color-background);
  background-size: 3rem 3rem, 3rem 3rem, auto;
  /* fixed, not the default scroll: every grid-painting element (this one, and each .slot-frame)
     is a separate box with its own local (0,0) origin, so a scroll-attached pattern re-starts its
     3rem tile phase at each box's own corner — visibly misaligned wherever two of these boxes
     meet, since pad-top/pad-x aren't exact multiples of 3rem. fixed anchors the pattern to the
     VIEWPORT instead of the element's own box, so every element painting it lines up on one
     shared grid regardless of where its own box happens to sit. */
  background-attachment: fixed, fixed, scroll;
  mask-image: linear-gradient(#000, #000), linear-gradient(#000, #000);
  mask-size: 100% 100%, var(--content-w) var(--content-h);
  mask-position: 0 0, var(--pad-x) var(--pad-top);
  mask-repeat: no-repeat;
  mask-composite: exclude;
  /* This element is page-absolute (inset:0), so the notch is measured directly from the page's
     own top-right corner: logo-inset + logo-size is the logo box's absolute bottom edge. Do not
     reuse .slot-frame's --notch-bottom formula here — that one subtracts --content-top because
     .slot-frame's own local origin sits at content-top, not page (0,0); applying it to this
     page-absolute element cuts a notch only 8px tall instead of the logo box's full 88px, leaving
     the grid pattern opaque over most of the logo placement (this exact regression once shipped:
     only a thin sliver near the logo's bottom edge was actually transparent). */
  clip-path: polygon(0 0, calc(100% - var(--logo-inset) - var(--logo-size)) 0, calc(100% - var(--logo-inset) - var(--logo-size)) calc(var(--logo-inset) + var(--logo-size)), calc(100% - var(--logo-inset)) calc(var(--logo-inset) + var(--logo-size)), calc(100% - var(--logo-inset)) 0, 100% 0, 100% 100%, 0 100%);
}
.texture { position: absolute; z-index: -1; top: 0; right: 0; left: 0; height: 7rem; background: linear-gradient(to bottom, var(--color-background), transparent); mask-image: linear-gradient(to bottom, var(--color-background) 45%, transparent); pointer-events: none; clip-path: polygon(0 0, calc(100% - var(--logo-inset) - var(--logo-size)) 0, calc(100% - var(--logo-inset) - var(--logo-size)) calc(var(--logo-inset) + var(--logo-size)), calc(100% - var(--logo-inset)) calc(var(--logo-inset) + var(--logo-size)), calc(100% - var(--logo-inset)) 0, 100% 0, 100% 100%, 0 100%); }
.brand { position: absolute; top: var(--space-5); left: var(--space-5); color: var(--color-accent); font-size: clamp(1.2rem, 2vw, 2rem); text-shadow: var(--glow-strong); letter-spacing: .08em; }
.brand span { color: var(--color-text); }
.brand small { margin-left: var(--space-2); color: var(--color-text-muted); font-size: .5em; }
.status-branding { position: absolute; z-index: 4; top: var(--space-5); right: var(--space-5); display: flex; align-items: center; gap: var(--space-2); }
.connection { padding: var(--space-1) var(--space-2); color: var(--color-text-muted); border: 1px solid var(--line-color); border-radius: var(--radius-sm); }
.connection.demo { color: var(--color-accent); text-shadow: var(--glow-soft); }
.slot, .logo-frame { display: grid; place-items: center; border: 1px dashed var(--color-accent-deep); background: transparent; }
.logo-frame { width: var(--logo-size); aspect-ratio: 1; border-radius: var(--radius-sm); }
/* position:relative (with no explicit z-index) puts .slot in the same "positioned, z-index:auto"
   stacking bucket as its sibling .slot-grid — ordered there by DOM order, and .slot comes after
   .slot-grid in markup, so its border always paints on top instead of risking a hairline overlap
   with slot-grid's own opaque grid pattern right at the hole's edge. */
.slot { position: relative; min-width: 0; min-height: 0; border-radius: var(--radius-md); }
/* .slot-grid paints its own local copy of the page grid, minus its own 16:9 hole, so the OBS
   source under it is only ever visible inside that real hole. It is a SIBLING of .slot (the
   dashed demo guide), not its parent: CSS mask/clip-path clip an element's entire rendered
   subtree, descendants included, not just that element's own background layer — so if the masked
   grid element were also .slot's ancestor, the hole would erase .slot's border along with the
   grid, since the border sits exactly inside that hole (this shipped once: the guide border was
   present in computed styles but never actually painted a visible pixel). Keeping them as
   siblings inside .slot-frame lets the grid mask a hole while .slot's border still paints on top
   of it, unaffected. mask-size's two slots resolve percentages against DIFFERENT axes of this
   element's own box (width-slot -> box width, height-slot -> box height) — reusing a bare
   "%"-based width value inside the height slot's calc() silently re-resolves that "%" against box
   height instead, corrupting the hole (this also shipped once: the hole rendered roughly half as
   tall as the real 16:9 box). --screen-w/--screen-h/--webcam-w/--webcam-h are vw/vh/rem-based on
   purpose (never a bare %) so they can be reused across the height slot safely, and are shared
   with .screen-slot/.webcam-slot below so the dashed guide can never drift from the real hole. */
.slot-frame { position: relative; min-width: 0; min-height: 0; overflow: hidden; display: grid; place-items: start center; }
.slot-grid {
  position: absolute; inset: 0;
  background: linear-gradient(var(--line-color) 1px, transparent 1px), linear-gradient(90deg, var(--line-color) 1px, transparent 1px), var(--color-background);
  background-size: 3rem 3rem, 3rem 3rem, auto;
  /* fixed, matching .padding-frame: keeps this box's own local grid tiling on the same
     viewport-anchored phase as every other grid-painting element, so the pattern reads as one
     continuous grid instead of visibly jogging wherever two boxes' edges meet. */
  background-attachment: fixed, fixed, scroll;
  mask-image: linear-gradient(#000, #000), linear-gradient(#000, #000);
  mask-position: 0 0, center top;
  mask-repeat: no-repeat;
  mask-composite: exclude;
  --notch-right: calc(var(--logo-inset) - var(--content-right));
  --notch-bottom: calc(var(--logo-inset) - var(--content-top) + var(--logo-size));
  clip-path: polygon(0 0, calc(100% - var(--notch-right) - var(--logo-size)) 0, calc(100% - var(--notch-right) - var(--logo-size)) var(--notch-bottom), calc(100% - var(--notch-right)) var(--notch-bottom), calc(100% - var(--notch-right)) 100%, 0 100%);
}
.screen-frame .slot-grid { mask-size: 100% 100%, var(--screen-w) var(--screen-h); }
.webcam-frame .slot-grid { mask-size: 100% 100%, var(--webcam-w) var(--webcam-h); }
.screen-slot { width: var(--screen-w); height: var(--screen-h); }
.webcam-slot { width: var(--webcam-w); height: var(--webcam-h); }
.feed { min-width: 0; align-self: end; }
.alerts { position: absolute; z-index: 2; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.layout-screen-webcam { grid-template-columns: minmax(0, 1fr) var(--side-col-w); grid-template-rows: minmax(0, 1fr) auto; gap: var(--space-4); }
.layout-screen-webcam .screen-frame { grid-row: 1 / 3; }
.layout-screen-webcam .feed { grid-column: 2; }
.layout-game { grid-template-columns: minmax(0, 1fr) var(--side-col-w); grid-template-rows: minmax(0, 1fr) auto; gap: var(--space-4); }
.layout-game .quiz-slot { grid-row: 1 / 3; }
.layout-game .feed { grid-column: 2; }
.layout-screen-only { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
.layout-screen-only .screen-frame { grid-column: 1; grid-row: 1; }
.layout-screen-only .feed { position: absolute; z-index: 3; align-self: stretch; top: calc(var(--pad-top) + var(--space-3)); right: calc(var(--screen-side-gutter) + var(--space-3)); bottom: calc(var(--pad-bottom) + var(--space-3)); width: min(24rem, 30vw); min-width: 16rem; }
.layout-screen-only .feed :deep(.live-chat) { display: flex; height: 100%; flex-direction: column; }
.layout-screen-only .feed :deep(.messages) { flex: 1; min-height: 0; max-height: none; align-content: start; }
@media (max-width: 700px) {
  .overlay { --pad-top: 4rem; --pad-x: var(--space-3); --pad-bottom: 3.5rem; }
  .layout-screen-webcam, .layout-game { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) auto; }
  .layout-screen-webcam .screen-frame, .layout-screen-webcam .webcam-frame, .layout-screen-webcam .feed, .layout-game .quiz-slot, .layout-game .webcam-frame, .layout-game .feed { grid-column: 1; grid-row: auto; }
  .brand, .status-branding { top: var(--space-3); }
  .brand { left: var(--space-3); }
  .brand small { display: none; }
  .status-branding { right: var(--space-3); }
  .layout-screen-only .feed { top: calc(var(--pad-top) + var(--space-2)); right: calc(var(--screen-side-gutter) + var(--space-2)); bottom: calc(var(--pad-bottom) + var(--space-2)); width: min(20rem, calc(100vw - var(--space-6))); min-width: 0; }
}
/* Portrait is a genuine recomposition, not landscape squeezed thinner: screen and webcam stack
   vertically instead of sharing a row, so each gets a height-based share of the column instead
   of the landscape side-column split. */
@media (orientation: portrait) {
  .overlay {
    --pad-top: 7rem;
    --screen-w: min(var(--content-w), calc(var(--content-h) * 0.55 * 16 / 10));
    --screen-h: calc(var(--screen-w) * 10 / 16);
    --webcam-w: min(var(--content-w), calc(var(--content-h) * 0.3 * 16 / 9));
  }
  .layout-screen-webcam, .layout-game {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: var(--space-3);
  }
  .layout-screen-webcam .screen-frame, .layout-game .quiz-slot { grid-column: 1; grid-row: 1; }
  .layout-screen-webcam .webcam-frame, .layout-game .webcam-frame { grid-column: 1; grid-row: 2; }
  /* align-self:stretch makes .feed's OWN grid cell fill the flexible row, but its child .live-chat
     card was still sizing to its own content — with few or no messages that left a tall, empty
     background gap between the card and the row's real bottom edge. Stretching .live-chat itself
     (same recipe .layout-screen-only already uses on desktop) makes the card fill the space
     instead of floating in it. */
  .layout-screen-webcam .feed, .layout-game .feed { grid-column: 1; grid-row: 3; align-self: stretch; }
  .layout-screen-webcam .feed :deep(.live-chat), .layout-game .feed :deep(.live-chat) { display: flex; height: 100%; flex-direction: column; }
  .layout-screen-webcam .feed :deep(.messages), .layout-game .feed :deep(.messages) { flex: 1; min-height: 0; max-height: none; align-content: start; }
  .layout-screen-only { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: var(--space-3); }
  .layout-screen-only .screen-frame { grid-column: 1; grid-row: 1; }
  .layout-screen-only .feed { position: static; grid-column: 1; grid-row: 2; align-self: stretch; }
}
</style>
