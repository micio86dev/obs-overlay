<script setup lang="ts">
import { computed, toRef } from "vue";
import type { ChatModeEvent, LiveState } from "@miciodev/shared-types";

const props = defineProps<{ state: LiveState; chatMode?: ChatModeEvent }>();
const state = toRef(props, "state");

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
  <footer class="live-status" aria-label="Live activity">
    <span v-if="state.concurrentViewers !== undefined" class="segment">VIEWERS {{ counts.format(state.concurrentViewers) }}</span>
    <span v-if="state.peakViewers !== undefined" class="segment optional">PEAK {{ counts.format(state.peakViewers) }}</span>
    <span v-if="state.session.chatMessages > 0" class="segment optional">CHAT {{ counts.format(state.session.chatMessages) }}</span>
    <span v-for="item in revenue" :key="item" class="segment">REVENUE {{ item }}</span>
    <span v-if="state.session.newMembers > 0" class="segment">NEW MEMBERS +{{ counts.format(state.session.newMembers) }}</span>
    <span v-if="state.session.giftedMemberships > 0" class="segment optional">GIFTED +{{ counts.format(state.session.giftedMemberships) }}</span>
    <span v-if="membersOnly" class="segment">MEMBERS ONLY</span>
    <span v-if="state.streamHealth && state.streamHealth !== 'unknown'" class="segment health" :class="state.streamHealth">STREAM {{ state.streamHealth.toUpperCase() }}</span>
  </footer>
</template>

<style scoped>
.live-status { position: absolute; z-index: 3; right: var(--space-5); bottom: var(--space-3); left: var(--space-5); display: flex; align-items: center; height: 2.25rem; min-width: 0; overflow: hidden; color: var(--color-text-muted); border: 1px solid var(--line-color); border-radius: var(--radius-sm); background: var(--color-surface-transparent); box-shadow: var(--glow-soft); font-size: clamp(.65rem, 1vw, .85rem); white-space: nowrap; backdrop-filter: blur(4px); }
.segment { display: inline-flex; align-items: center; height: 100%; gap: var(--space-1); padding: 0 var(--space-3); border-right: 1px solid var(--line-color); }
.segment:last-child { border-right: 0; }
.health.warning { color: var(--color-accent-bright); }
.health.error { color: var(--color-danger); }
/* Narrow sources drop only the least useful segments; viewers always survive. */
@media (max-width: 700px) { .live-status { right: var(--space-3); bottom: var(--space-2); left: var(--space-3); } .segment { padding: 0 var(--space-2); } .optional { display: none; } }
</style>
