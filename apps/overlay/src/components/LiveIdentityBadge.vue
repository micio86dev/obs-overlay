<script setup lang="ts">
import { computed, toRef } from "vue";
import type { LiveState } from "@miciodev/shared-types";
import { useLiveClock } from "../composables/live-state";

const props = defineProps<{ state: LiveState; demo?: boolean }>();
const state = toRef(props, "state");
const time = useLiveClock(state);
const label = computed(() => props.demo ? "DEMO" : state.value.status.toUpperCase());
const counts = new Intl.NumberFormat();
const subscriberLabel = computed(() => state.value.subscriberCount === undefined ? undefined : `${counts.format(state.value.subscriberCount)} SUBSCRIBERS`);
</script>

<template>
  <div class="identity" aria-label="Channel status">
    <span class="badge" :class="state.status" aria-live="polite"><i aria-hidden="true"></i>{{ label }}<template v-if="time"> · {{ time }}</template></span>
    <span v-if="subscriberLabel" class="subs optional">{{ subscriberLabel }}</span>
  </div>
</template>

<style scoped>
.identity { display: flex; align-items: center; gap: var(--space-2); }
.badge, .subs { display: inline-flex; align-items: center; gap: var(--space-1); padding: var(--space-1) var(--space-2); border: 1px solid var(--line-color); border-radius: var(--radius-sm); letter-spacing: .06em; white-space: nowrap; }
.badge { color: var(--color-accent); text-shadow: var(--glow-soft); }
.badge i { width: .42rem; height: .42rem; border-radius: 50%; background: currentColor; }
.badge.live i { animation: pulse 1.8s ease-in-out infinite; }
.badge.upcoming, .badge.testing { color: var(--color-accent-bright); }
.badge.complete, .badge.offline, .badge.unknown { color: var(--color-text-muted); }
.subs { color: var(--color-text-muted); font-size: .8em; }
@keyframes pulse { 50% { opacity: .4; transform: scale(.75); } }
@media (prefers-reduced-motion: reduce) { .badge.live i { animation: none; } }
@media (max-width: 700px) { .optional { display: none; } }
</style>
