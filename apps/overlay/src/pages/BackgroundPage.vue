<script setup lang="ts">
// This source sits at the bottom of the OBS scene's z-order: every other overlay page and every
// capture source (screen, webcam) is stacked above it. Unlike the old single-page overlay, it
// never needs to punch a transparent hole for anything — whatever sits on top simply covers it.
</script>

<template>
  <div class="background" aria-hidden="true"></div>
</template>

<style scoped>
.background {
  position: fixed;
  inset: 0;
  background:
    linear-gradient(var(--line-color) 1px, transparent 1px),
    linear-gradient(90deg, var(--line-color) 1px, transparent 1px),
    var(--color-background);
  background-size: 3rem 3rem, 3rem 3rem, auto;
}
</style>
