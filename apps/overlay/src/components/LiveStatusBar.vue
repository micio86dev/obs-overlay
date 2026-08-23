<script setup lang="ts">
import { computed, toRef } from "vue";
import type { ChatModeEvent, LiveState } from "@miciodev/shared-types";
import { useLiveClock } from "../composables/live-state";

const props = defineProps<{ state: LiveState; demo?: boolean; chatMode?: ChatModeEvent }>();
const state = toRef(props, "state");
const time = useLiveClock(state);
const label = computed(() => props.demo ? "DEMO" : state.value.status.toUpperCase());

const counts = new Intl.NumberFormat();
function formatCurrency(currency: string, micros: number): string {
  const amount = micros / 1_000_000;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    // A currency the runtime does not know must still render, just without a symbol.
    return `${currency} ${amount.toFixed(2)}`;
  }
}
const revenue = computed(() => Object.entries(state.value.session.superChatRevenueMicros).map(([currency, micros]) => formatCurrency(currency, micros)));
const membersOnly = computed(() => props.chatMode?.enabled === true);
</script>

<template>
  <footer class="live-status" aria-label="Live broadcast status">
    <span class="segment live" :class="state.status" aria-live="polite"><i aria-hidden="true"></i>{{ label }}</span>
    <span v-if="time" class="segment">{{ state.status === 'upcoming' ? 'STARTS' : 'LIVE FOR' }} {{ time }}</span>
    <span v-if="state.concurrentViewers !== undefined" class="segment">◉ {{ counts.format(state.concurrentViewers) }}</span>
    <span v-if="state.session.chatMessages > 0" class="segment optional">▣ {{ counts.format(state.session.chatMessages) }}</span>
    <span v-if="state.peakViewers !== undefined" class="segment optional">PEAK {{ counts.format(state.peakViewers) }}</span>
    <span v-for="item in revenue" :key="item" class="segment">{{ item }}</span>
    <span v-if="state.session.newMembers > 0" class="segment">MEM +{{ counts.format(state.session.newMembers) }}</span>
    <span v-if="state.session.giftedMemberships > 0" class="segment optional">GIFT {{ counts.format(state.session.giftedMemberships) }}</span>
    <span v-if="membersOnly" class="segment">MEMBERS ONLY</span>
    <span v-if="state.streamHealth && state.streamHealth !== 'unknown'" class="segment health" :class="state.streamHealth">STREAM {{ state.streamHealth.toUpperCase() }}</span>
  </footer>
</template>

<style scoped>
.live-status { position: absolute; z-index: 3; right: var(--space-5); bottom: var(--space-3); left: var(--space-5); display: flex; align-items: center; height: 2.25rem; min-width: 0; overflow: hidden; color: var(--color-text-muted); border: 1px solid var(--line-color); border-radius: var(--radius-sm); background: var(--color-surface-transparent); box-shadow: var(--glow-soft); font-size: clamp(.65rem, 1vw, .85rem); white-space: nowrap; backdrop-filter: blur(4px); }
.segment { display: inline-flex; align-items: center; height: 100%; gap: var(--space-1); padding: 0 var(--space-3); border-right: 1px solid var(--line-color); }
.segment:last-child { border-right: 0; }
.live { color: var(--color-accent); letter-spacing: .08em; text-shadow: var(--glow-soft); }
.live i { width: .48rem; height: .48rem; border-radius: 50%; background: currentColor; }
.live.live i { animation: pulse 1.8s ease-in-out infinite; }
.live.upcoming, .live.testing { color: var(--color-accent-bright); }
.live.complete, .live.offline, .live.unknown { color: var(--color-text-muted); }
.health.warning { color: var(--color-accent-bright); }
.health.error { color: var(--color-danger); }
@keyframes pulse { 50% { opacity: .4; transform: scale(.75); } }
@media (prefers-reduced-motion: reduce) { .live.live i { animation: none; } }
/* Narrow sources drop only the least useful segments; status and viewers always survive. */
@media (max-width: 700px) { .live-status { right: var(--space-3); bottom: var(--space-2); left: var(--space-3); } .segment { padding: 0 var(--space-2); } .optional { display: none; } }
</style>
