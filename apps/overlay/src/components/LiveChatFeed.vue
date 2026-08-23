<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { ChatEvent, OverlayEvent } from "@miciodev/shared-types";
import ChatMessage from "./ChatMessage.vue";
import { selectChatEvents } from "../composables/live-chat";

const props = withDefaults(defineProps<{ events: OverlayEvent[]; maxVisible?: number }>(), { maxVisible: 7 });
const feed = ref<HTMLElement>();
const visibleEvents = ref<ChatEvent[]>([]);

watch(() => props.events, async (events) => {
  visibleEvents.value = selectChatEvents(events, props.maxVisible);
  await nextTick();
  if (feed.value) feed.value.scrollTop = feed.value.scrollHeight;
}, { deep: true, immediate: true });
</script>

<template>
  <section class="live-chat" aria-label="Live chat">
    <header><span class="signal" aria-hidden="true"></span> LIVE CHAT</header>
    <div ref="feed" class="messages" role="log" aria-live="polite">
      <ChatMessage v-for="(event, index) in visibleEvents" :key="event.id" :event="event" :class="{ fading: index < visibleEvents.length - 4 }" />
    </div>
  </section>
</template>

<style scoped>
.live-chat { min-width: 0; background: var(--color-surface-transparent); border: 1px solid var(--line-color); border-radius: var(--radius-md); box-shadow: var(--glow-soft); backdrop-filter: blur(6px); }
header { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3); color: var(--color-accent); border-bottom: 1px solid var(--line-color); text-shadow: var(--glow-soft); }
.signal { width: var(--space-2); height: var(--space-2); border-radius: 50%; background: var(--color-accent); box-shadow: var(--glow-soft); animation: pulse 1.4s ease-in-out infinite; }
.messages { display: grid; gap: var(--space-2); max-height: 38vh; padding: var(--space-3); overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--color-accent-deep) transparent; }
.fading { opacity: .48; transition: opacity var(--duration-base) var(--easing-glitch); }
@keyframes pulse { 50% { opacity: .4; transform: scale(.8); } }
@media (prefers-reduced-motion: reduce) { .signal { animation: none; } .fading { transition: none; } }
</style>
