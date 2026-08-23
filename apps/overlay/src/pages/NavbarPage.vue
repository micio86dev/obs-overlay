<script setup lang="ts">
import LiveIdentityBadge from "../components/LiveIdentityBadge.vue";
import { useOverlayEvents } from "../composables/useOverlayEvents";

const { demoMode, status, liveState } = useOverlayEvents();
</script>

<template>
  <main class="navbar">
    <header class="brand"><span>MICIO</span>DEV <small>ISCRIVITI CAGNACCIO!</small></header>
    <div class="status-branding">
      <LiveIdentityBadge v-if="liveState" :state="liveState" :demo="demoMode" />
      <aside class="connection" :class="{ demo: demoMode }">{{ demoMode ? "DEMO MODE" : status }}</aside>
    </div>
  </main>
</template>

<style scoped>
.navbar { position: relative; width: 100vw; height: 100vh; }
.brand { position: fixed; top: var(--space-5); left: var(--space-5); color: var(--color-accent); font-size: clamp(1.2rem, 2vw, 2rem); text-shadow: var(--glow-strong); letter-spacing: .08em; }
.brand span { color: var(--color-text); }
.brand small { margin-left: var(--space-2); color: var(--color-text-muted); font-size: .5em; }
.status-branding { position: fixed; top: var(--space-5); right: var(--space-5); display: flex; align-items: center; gap: var(--space-2); }
.connection { padding: var(--space-1) var(--space-2); color: var(--color-text-muted); border: 1px solid var(--line-color); border-radius: var(--radius-sm); }
.connection.demo { color: var(--color-accent); text-shadow: var(--glow-soft); }
@media (max-width: 700px) {
  .brand, .status-branding { top: var(--space-3); }
  .brand { left: var(--space-3); }
  .brand small { display: none; }
  .status-branding { right: var(--space-3); }
}
</style>
