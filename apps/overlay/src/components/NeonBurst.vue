<script setup lang="ts">
import type { OverlayEventType } from "@miciodev/shared-types";
defineProps<{ type: OverlayEventType }>();
</script>

<template>
  <svg class="burst" viewBox="0 0 160 160" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-width="3">
      <path d="M80 8v38M80 114v38M8 80h38M114 80h38M29 29l27 27M104 104l27 27M131 29l-27 27M56 104l-27 27" />
      <circle cx="80" cy="80" r="24" />
    </g>
  </svg>
</template>

<style scoped>
.burst { width: 8rem; color: var(--color-accent); filter: drop-shadow(var(--glow-strong)); animation: burst var(--duration-base) var(--easing-glitch) both; }
@keyframes burst { from { opacity: 0; transform: scale(.35) rotate(-15deg); } 65% { opacity: 1; transform: scale(1.12) rotate(4deg); } to { transform: scale(1) rotate(0); } }
@media (prefers-reduced-motion: reduce) { .burst { animation: none; } }
</style>
