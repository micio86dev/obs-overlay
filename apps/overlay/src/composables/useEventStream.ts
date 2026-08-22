import { computed, onBeforeUnmount, ref } from "vue";
import type { OverlayEvent } from "@miciodev/shared-types";
import { EventStreamClient } from "./event-stream-client";

export function useEventStream(onEvent: (event: OverlayEvent) => void) {
  const connected = ref(false);
  const status = computed(() => (connected.value ? "LIVE" : "RECONNECTING"));
  const url = import.meta.env.VITE_RELAY_URL ?? "ws://localhost:8787/events";
  const client = new EventStreamClient(url, onEvent, (value) => { connected.value = value; });
  client.start();
  onBeforeUnmount(() => {
    client.stop();
  });

  return { connected, status };
}
