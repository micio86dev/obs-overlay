<script setup lang="ts">
import PythonQuizBoard from "../components/PythonQuizBoard.vue";
import { useOverlayEvents } from "../composables/useOverlayEvents";

const { events } = useOverlayEvents();
</script>

<template>
  <main class="quiz-page">
    <PythonQuizBoard :events="events" />
  </main>
</template>

<style scoped>
/* display:grid + fixed inset gives PythonQuizBoard's own root (also display:grid) a real box to
   stretch into — CSS grid stretches a single item to fill its cell by default, so the board needs
   no width/height rules of its own even though it used to rely on a shared grid-row span instead. */
.quiz-page { position: fixed; inset: 0; display: grid; padding: var(--space-4); box-sizing: border-box; }
</style>
