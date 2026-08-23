<script setup lang="ts">
import { computed } from "vue";
import type { ChatEvent } from "@miciodev/shared-types";

const props = defineProps<{ event: ChatEvent }>();
const text = computed(() => props.event.message);
const role = computed(() => props.event.isOwner ? "owner" : props.event.isModerator ? "moderator" : props.event.isMember ? "member" : undefined);
</script>

<template>
  <article class="chat-message" :class="role">
    <img v-if="event.avatarUrl" class="avatar" :src="event.avatarUrl" alt="" loading="lazy" decoding="async" width="18" height="18" />
    <span class="author">{{ event.author }}</span>
    <span class="message">{{ text }}</span>
  </article>
</template>

<style scoped>
.chat-message { display: grid; grid-template-columns: auto 1fr; align-items: baseline; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-left: 2px solid var(--color-accent-deep); background: var(--color-surface-transparent); border-radius: var(--radius-sm); overflow: hidden; }
.chat-message:has(.avatar) { grid-template-columns: auto auto 1fr; }
.avatar { align-self: center; width: 1.125rem; height: 1.125rem; border-radius: 50%; }
.author { color: var(--color-accent-bright); text-shadow: var(--glow-soft); white-space: nowrap; }
.message { color: var(--color-text); min-width: 0; overflow-wrap: anywhere; }
.owner, .moderator { border-left-color: var(--color-accent); }
.owner .author, .moderator .author { text-shadow: var(--glow-strong); }
.member .author { color: var(--color-accent); }
</style>
