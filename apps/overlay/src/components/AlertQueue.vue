<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { OverlayEvent, SuperChatEvent } from "@miciodev/shared-types";
import NeonBurst from "./NeonBurst.vue";

const props = defineProps<{ events: OverlayEvent[] }>();
type AlertEvent = Exclude<OverlayEvent, { type: "chat" }>;
const queue = ref<AlertEvent[]>([]);
const active = ref<AlertEvent>();
let timer: ReturnType<typeof setTimeout> | undefined;

const label = computed(() => active.value?.type === "superchat" ? "SUPER CHAT" : "NEW SUBSCRIBER");
const superChat = computed<SuperChatEvent | undefined>(() => active.value?.type === "superchat" ? active.value : undefined);

function playSound(event: OverlayEvent): void {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = event.type === "superchat" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(event.type === "superchat" ? 660 : 440, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(event.type === "superchat" ? 990 : 660, context.currentTime + .16);
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.12, context.currentTime + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .38);
    oscillator.connect(gain).connect(context.destination);
    void context.resume();
    oscillator.start();
    oscillator.stop(context.currentTime + .4);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    // A locked-down browser source still renders the alert without sound.
  }
}

function advance(): void {
  active.value = queue.value.shift();
  if (!active.value) return;
  playSound(active.value);
  timer = setTimeout(advance, 4_800);
}

watch(() => props.events, (events) => {
  const incoming = events.at(-1);
  if (!incoming || incoming.type === "chat") return;
  queue.value.push(incoming);
  if (!active.value) advance();
}, { deep: true });

onBeforeUnmount(() => { if (timer) clearTimeout(timer); });
</script>

<template>
  <Transition name="glitch">
    <section v-if="active" class="alert" aria-live="assertive">
      <NeonBurst :type="active.type" />
      <div class="content">
        <p class="eyebrow">{{ label }}</p>
        <h1>{{ active.author }}</h1>
        <p v-if="superChat" class="amount">{{ superChat.amount }}</p>
        <p class="message">{{ active.message ?? "Welcome!" }}</p>
      </div>
    </section>
  </Transition>
</template>

<style scoped>
.alert { display: flex; align-items: center; gap: var(--space-4); max-width: min(74vw, 52rem); padding: var(--space-4) var(--space-6); border: 1px solid var(--color-accent); border-radius: var(--radius-md); background: var(--color-surface-transparent); box-shadow: var(--glow-strong); backdrop-filter: blur(8px); }
.content { min-width: 0; }
.eyebrow, .amount { margin: 0; color: var(--color-accent); letter-spacing: .12em; text-shadow: var(--glow-strong); }
h1 { margin: var(--space-1) 0; color: var(--color-text); font-size: clamp(1.4rem, 3.2vw, 3rem); overflow-wrap: anywhere; }
.message { margin: 0; color: var(--color-text-muted); overflow-wrap: anywhere; }
.glitch-enter-active, .glitch-leave-active { transition: opacity var(--duration-fast) var(--easing-glitch), transform var(--duration-fast) var(--easing-glitch); }
.glitch-enter-from, .glitch-leave-to { opacity: 0; transform: translateX(var(--space-4)) skewX(-4deg); }
</style>
