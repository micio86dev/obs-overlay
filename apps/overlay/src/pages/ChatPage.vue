<script setup lang="ts">
import LiveChatFeed from "../components/LiveChatFeed.vue";
import { useOverlayEvents } from "../composables/useOverlayEvents";

const { events } = useOverlayEvents();
</script>

<template>
  <main class="chat-page">
    <div class="feed"><LiveChatFeed :events="events" /></div>
  </main>
</template>

<style scoped>
/* This page has no anchor/cap of its own on purpose: OBS owns the Browser Source's size and
   position, so the panel fills exactly whatever box that source is — grow it for more visible
   messages, crop it tight for a small corner widget, wherever the streamer places it. */
.chat-page { position: fixed; inset: 0; }
.feed { position: absolute; inset: 0; }
.feed :deep(.live-chat) { display: flex; width: 100%; height: 100%; flex-direction: column; box-sizing: border-box; }
.feed :deep(.messages) { flex: 1; min-height: 0; max-height: none; align-content: start; }
</style>
