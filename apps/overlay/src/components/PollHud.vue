<script setup lang="ts">
import { computed } from "vue";
import type { PollEvent } from "@miciodev/shared-types";
import { pollChoiceShares } from "../composables/poll-state";

const props = defineProps<{ poll: PollEvent }>();
const choices = computed(() => pollChoiceShares(props.poll.choices));
const ended = computed(() => props.poll.pollStatus === "ended");
</script>

<template>
  <aside class="poll-hud" :class="{ ended }" aria-label="Live poll" aria-live="polite">
    <p class="eyebrow">{{ ended ? "POLL RESULT" : "LIVE POLL" }}</p>
    <p class="question">{{ poll.question }}</p>
    <ul>
      <li v-for="choice in choices" :key="choice.text">
        <span class="bar" :style="{ width: `${choice.share ?? 0}%` }" aria-hidden="true"></span>
        <span class="text">{{ choice.text }}</span>
        <span v-if="choice.share !== undefined" class="share">{{ choice.share }}%</span>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.poll-hud { position: absolute; z-index: 3; right: var(--space-5); bottom: 4rem; width: min(20rem, 28vw); padding: var(--space-2) var(--space-3); border: 1px solid var(--line-color); border-radius: var(--radius-sm); background: var(--color-surface-transparent); box-shadow: var(--glow-soft); font-size: clamp(.65rem, .9vw, .8rem); backdrop-filter: blur(4px); }
.poll-hud.ended { border-color: var(--color-accent-deep); }
.eyebrow { color: var(--color-accent); letter-spacing: .1em; text-shadow: var(--glow-soft); }
.question { margin-top: var(--space-1); color: var(--color-text); overflow-wrap: anywhere; }
ul { display: grid; gap: var(--space-1); margin-top: var(--space-2); list-style: none; }
li { position: relative; display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2); padding: 2px var(--space-2); border-radius: var(--radius-sm); background: rgb(101 255 143 / 6%); overflow: hidden; }
.bar { position: absolute; inset: 0 auto 0 0; background: var(--color-accent-deep); opacity: .35; transition: width var(--duration-base) var(--easing-glitch); }
.text, .share { position: relative; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.share { color: var(--color-accent-bright); }
@media (prefers-reduced-motion: reduce) { .bar { transition: none; } }
@media (max-width: 700px) { .poll-hud { right: var(--space-3); bottom: 3.25rem; width: min(16rem, calc(100vw - var(--space-6))); } }
</style>
