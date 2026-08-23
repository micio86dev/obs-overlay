<script setup lang="ts">
import AlertQueue from "../components/AlertQueue.vue";
import PollHud from "../components/PollHud.vue";
import ReactionBurst from "../components/ReactionBurst.vue";
import { useOverlayEvents } from "../composables/useOverlayEvents";

const { events, visiblePoll } = useOverlayEvents();
</script>

<template>
  <main class="alerts-page">
    <div class="alerts"><AlertQueue :events="events" /></div>
    <ReactionBurst :events="events" />
    <PollHud v-if="visiblePoll" :poll="visiblePoll" />
  </main>
</template>

<style scoped>
.alerts-page { position: relative; width: 100vw; height: 100vh; }
.alerts { position: fixed; z-index: 2; left: 50%; top: 50%; transform: translate(-50%, -50%); }
</style>
