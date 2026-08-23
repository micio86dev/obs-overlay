<script setup lang="ts">
import LiveStatusBar from "../components/LiveStatusBar.vue";
import { useOverlayEvents } from "../composables/useOverlayEvents";

const { liveState, chatMode } = useOverlayEvents();
</script>

<template>
  <main class="footer-page">
    <LiveStatusBar v-if="liveState" :state="liveState" :chat-mode="chatMode" />
  </main>
</template>

<style scoped>
.footer-page { position: relative; width: 100vw; height: 100vh; }
</style>
