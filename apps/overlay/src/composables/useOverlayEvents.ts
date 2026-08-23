import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from "vue";
import type { ChatModeEvent, LiveState, OverlayEvent, PollEvent } from "@miciodev/shared-types";
import { isDemoMode, useDemoEvents } from "./useDemoEvents";
import { useEventStream } from "./useEventStream";
import { selectVisiblePoll } from "./poll-state";

export interface OverlayEvents {
  events: Ref<OverlayEvent[]>;
  demoMode: boolean;
  status: ComputedRef<string>;
  liveState: Ref<LiveState> | undefined;
  chatMode: ComputedRef<ChatModeEvent | undefined>;
  visiblePoll: ComputedRef<PollEvent | undefined>;
}

/**
 * Each overlay page is its own OBS Browser Source, so each one opens its own connection (real or
 * demo) instead of sharing a single App-wide event stream. This composable is that connection,
 * factored out so every page wires it up the same way instead of re-deriving it per page.
 */
export function useOverlayEvents(): OverlayEvents {
  const events = ref<OverlayEvent[]>([]);

  function receive(event: OverlayEvent): void {
    if (events.value.some((item) => item.id === event.id)) return;
    events.value = [...events.value, event].slice(-30);
  }

  const demoMode = isDemoMode();
  const stream = demoMode ? undefined : useEventStream(receive);
  const demo = demoMode ? useDemoEvents(receive) : undefined;
  const status = stream?.status ?? computed(() => "DEMO MODE");
  const liveState = stream?.liveState ?? demo?.liveState;

  // The last chat-mode event is sticky: members-only stays true until YouTube says otherwise.
  const chatMode = computed<ChatModeEvent | undefined>(() => events.value.filter((event): event is ChatModeEvent => event.type === "chat-mode").at(-1));

  // One shared second-tick drives the poll grace period; no per-component rAF loop.
  const now = ref(Date.now());
  const clock = setInterval(() => { now.value = Date.now(); }, 1_000);
  onBeforeUnmount(() => clearInterval(clock));
  const visiblePoll = computed(() => selectVisiblePoll(events.value, now.value));

  return { events, demoMode, status, liveState, chatMode, visiblePoll };
}
