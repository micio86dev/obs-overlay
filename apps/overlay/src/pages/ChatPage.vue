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
.chat-page { position: relative; width: 100vw; height: 100vh; }
/* Default anchor is the bottom-right corner; OBS itself owns the source's real position and size,
   so a streamer who wants the panel elsewhere resizes/moves this Browser Source instead of the
   overlay needing a layout variant per placement. */
.feed { position: fixed; right: var(--space-5); bottom: var(--space-5); width: min(24rem, 30vw); min-width: 16rem; }
.feed :deep(.live-chat) { display: flex; max-height: calc(100vh - var(--space-6) * 2); flex-direction: column; }
.feed :deep(.messages) { flex: 1; min-height: 0; max-height: none; align-content: start; }
@media (max-width: 700px) {
  .feed { right: var(--space-3); bottom: var(--space-3); width: min(20rem, calc(100vw - var(--space-6))); min-width: 0; }
}
</style>
