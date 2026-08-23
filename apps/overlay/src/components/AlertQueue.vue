<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { OverlayEvent, SuperChatEvent } from "@miciodev/shared-types";
import NeonBurst from "./NeonBurst.vue";
import { createAlertSoundPlayer } from "./alert-sound";
import { BoundedAlertQueue, isAlertEvent, type AlertEvent } from "../composables/alert-queue";

const props = defineProps<{ events: OverlayEvent[] }>();
const alertQueue = new BoundedAlertQueue();
const active = ref<AlertEvent>();
let timer: ReturnType<typeof setTimeout> | undefined;
const soundPlayer = createAlertSoundPlayer();
const seenEventIds = new Set<string>();
// Mirrors --duration-alert in theme.css; the alert must clear before the next one animates in.
const alertDurationMs = 4_800;

const labels: Record<AlertEvent["type"], string> = { superchat: "SUPER CHAT", supersticker: "SUPER STICKER", subscriber: "NEW MEMBER", "member-milestone": "MEMBER MILESTONE", "membership-gift": "MEMBERSHIP GIFT", "membership-gift-received": "GIFTED MEMBERSHIPS", poll: "LIVE POLL", "chat-mode": "CHAT STATUS" };
const label = computed(() => active.value ? labels[active.value.type] : "LIVE UPDATE");
const superChat = computed<SuperChatEvent | undefined>(() => active.value?.type === "superchat" ? active.value : undefined);

function unlockSound(): void { void soundPlayer.unlock(); }

document.addEventListener("pointerdown", unlockSound, { once: true });
document.addEventListener("keydown", unlockSound, { once: true });

function advance(): void {
  active.value = alertQueue.take();
  if (!active.value) return;
  void soundPlayer.play(active.value);
  timer = setTimeout(advance, alertDurationMs);
}

watch(() => props.events, (events) => {
  for (const incoming of events) {
    if (seenEventIds.has(incoming.id)) continue;
    seenEventIds.add(incoming.id);
    if (seenEventIds.size > 500) {
      const oldest = seenEventIds.values().next().value;
      if (typeof oldest === "string") seenEventIds.delete(oldest);
    }
    if (isAlertEvent(incoming)) alertQueue.enqueue(incoming);
  }
  if (!active.value) advance();
}, { deep: true });

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
  document.removeEventListener("pointerdown", unlockSound);
  document.removeEventListener("keydown", unlockSound);
  seenEventIds.clear();
  soundPlayer.dispose();
});
</script>

<template>
  <Transition name="glitch">
    <section v-if="active" class="alert" aria-live="assertive">
      <NeonBurst :type="active.type" />
      <div class="content">
        <p class="eyebrow">{{ label }}</p>
        <div class="author-line">
          <img v-if="active.avatarUrl" class="avatar" :src="active.avatarUrl" alt="" loading="lazy" decoding="async" width="40" height="40" />
          <h1>{{ active.author }}</h1>
        </div>
        <p v-if="superChat" class="amount">{{ superChat.amount }}</p>
        <p v-else-if="active?.type === 'supersticker'" class="amount">{{ active.amount }} {{ active.stickerAltText ?? '' }}</p>
        <p v-else-if="active?.type === 'membership-gift'" class="message">{{ active.membershipCount }} memberships{{ active.levelName ? ` · ${active.levelName}` : '' }}</p>
        <p v-else-if="active?.type === 'membership-gift-received'" class="message">{{ active.recipientCount }} viewers received memberships</p>
        <p v-else-if="active?.type === 'member-milestone'" class="message">{{ active.memberMonths }} months{{ active.message ? ` · ${active.message}` : '' }}</p>
        <p v-else-if="active?.type === 'poll'" class="message">{{ active.question }} · {{ active.choices.map((choice) => choice.text).join(' / ') }}</p>
        <p v-else-if="active?.type === 'chat-mode'" class="message">{{ active.enabled ? `${active.chatMode} enabled` : `${active.chatMode} disabled` }}</p>
        <p v-else class="message">{{ active?.message ?? "Welcome!" }}</p>
      </div>
    </section>
  </Transition>
</template>

<style scoped>
.alert { display: flex; align-items: center; gap: var(--space-4); max-width: min(74vw, 52rem); padding: var(--space-4) var(--space-6); border: 1px solid var(--color-accent); border-radius: var(--radius-md); background: var(--color-surface-transparent); box-shadow: var(--glow-strong); backdrop-filter: blur(8px); }
.content { min-width: 0; }
.eyebrow, .amount { margin: 0; color: var(--color-accent); letter-spacing: .12em; text-shadow: var(--glow-strong); }
.author-line { display: flex; align-items: center; gap: var(--space-2); margin: var(--space-1) 0; }
.avatar { flex: none; width: 2.5rem; height: 2.5rem; border-radius: 50%; box-shadow: var(--glow-soft); }
h1 { margin: 0; color: var(--color-text); font-size: clamp(1.4rem, 3.2vw, 3rem); overflow-wrap: anywhere; }
.message { margin: 0; color: var(--color-text-muted); overflow-wrap: anywhere; }
.glitch-enter-active, .glitch-leave-active { transition: opacity var(--duration-fast) var(--easing-glitch), transform var(--duration-fast) var(--easing-glitch); }
.glitch-enter-from, .glitch-leave-to { opacity: 0; transform: translateX(var(--space-4)) skewX(-4deg); }
@media (prefers-reduced-motion: reduce) { .glitch-enter-active, .glitch-leave-active { transition: opacity var(--duration-fast) linear; } .glitch-enter-from, .glitch-leave-to { transform: none; } }
</style>
