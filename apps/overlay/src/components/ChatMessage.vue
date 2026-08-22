<script setup lang="ts">
import { computed } from "vue";
import type { OverlayEvent, SuperChatEvent } from "@miciodev/shared-types";

const props = defineProps<{ event: OverlayEvent }>();
const text = computed(() => props.event.type === "chat" ? props.event.message : props.event.type === "superchat" ? props.event.message : props.event.message ?? "New subscriber");
const superChat = computed<SuperChatEvent | undefined>(() => props.event.type === "superchat" ? props.event : undefined);
</script>

<template>
  <article class="chat-message">
    <span class="author">{{ event.author }}</span>
    <span class="message">{{ text }}</span>
    <span v-if="superChat" class="amount">{{ superChat.amount }}</span>
  </article>
</template>

<style scoped>
.chat-message { display: grid; grid-template-columns: auto 1fr auto; align-items: baseline; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-left: 2px solid var(--color-accent-deep); background: var(--color-surface-transparent); border-radius: var(--radius-sm); overflow: hidden; }
.author, .amount { color: var(--color-accent-bright); text-shadow: var(--glow-soft); white-space: nowrap; }
.message { color: var(--color-text); min-width: 0; overflow-wrap: anywhere; }
</style>
