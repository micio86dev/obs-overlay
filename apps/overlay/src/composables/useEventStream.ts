import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from "vue";
import type { LiveState, OverlayEvent } from "@miciodev/shared-types";
import { EventStreamClient } from "./event-stream-client";
import { createInitialLiveState, mergeLiveState } from "./live-state";

export interface EventStream {
  connected: Ref<boolean>;
  status: ComputedRef<string>;
  liveState: Ref<LiveState>;
}

export function useEventStream(onEvent: (event: OverlayEvent) => void): EventStream {
  const connected = ref(false);
  const liveState = ref(createInitialLiveState());
  const status = computed(() => (connected.value ? "LIVE" : "RECONNECTING"));
  const url = import.meta.env.VITE_RELAY_URL ?? "ws://localhost:8787/events";
  const client = new EventStreamClient(url, onEvent, (value) => { connected.value = value; }, undefined, (state) => { liveState.value = mergeLiveState(liveState.value, state); });
  client.start();
  onBeforeUnmount(() => {
    client.stop();
  });

  return { connected, status, liveState };
}
