<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import type { OverlayEvent } from "@miciodev/shared-types";
import { createFloatingReactions, type FloatingReaction } from "../composables/emoji-reactions";

const props = defineProps<{ events: OverlayEvent[] }>();
const maxConcurrent = 24;
const reactions = ref<FloatingReaction[]>([]);
const seenEventIds = new Set<string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function remove(id: string): void {
  reactions.value = reactions.value.filter((reaction) => reaction.id !== id);
  timers.delete(id);
}

function spawn(reaction: FloatingReaction): void {
  reactions.value = [...reactions.value, reaction].slice(-maxConcurrent);
  timers.set(reaction.id, setTimeout(() => remove(reaction.id), reaction.durationMs + 300));
}

watch(() => props.events, (events) => {
  for (const event of events) {
    if (seenEventIds.has(event.id)) continue;
    seenEventIds.add(event.id);
    if (seenEventIds.size > 500) {
      const oldest = seenEventIds.values().next().value;
      if (typeof oldest === "string") seenEventIds.delete(oldest);
    }
    if (event.type !== "chat") continue;
    for (const reaction of createFloatingReactions(event)) spawn(reaction);
  }
}, { deep: true });

onBeforeUnmount(() => {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  seenEventIds.clear();
});
</script>

<template>
  <div class="reactions" aria-hidden="true">
    <span
      v-for="reaction in reactions"
      :key="reaction.id"
      class="reaction"
      :style="{ left: `${reaction.left}%`, fontSize: `${reaction.sizeRem}rem`, animationDuration: `${reaction.durationMs}ms`, '--drift': `${reaction.driftRem}rem` }"
    >{{ reaction.emoji }}</span>
  </div>
</template>

<style scoped>
.reactions { position: absolute; inset: 0; z-index: 5; overflow: hidden; pointer-events: none; }
.reaction { position: absolute; bottom: -3rem; line-height: 1; filter: drop-shadow(var(--glow-soft)); animation-name: float-up; animation-timing-function: ease-in; animation-fill-mode: forwards; will-change: transform, opacity; }
@keyframes float-up {
  0% { transform: translate(0, 0) scale(.6); opacity: 0; }
  12% { opacity: 1; transform: translate(0, -12vh) scale(1); }
  100% { transform: translate(var(--drift), -128vh) scale(1); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) { .reaction { animation: none; opacity: 0; } }
</style>
