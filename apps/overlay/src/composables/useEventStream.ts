import { computed, onBeforeUnmount, ref } from "vue";
import type { OverlayEvent } from "@miciodev/shared-types";
import { isOverlayEvent } from "@miciodev/shared-types";

const maxReconnectDelay = 10_000;

export function useEventStream(onEvent: (event: OverlayEvent) => void) {
  const connected = ref(false);
  const status = computed(() => (connected.value ? "LIVE" : "RECONNECTING"));
  let socket: WebSocket | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;

  const url = import.meta.env.VITE_RELAY_URL ?? "ws://localhost:8787/events";

  const connect = (): void => {
    socket = new WebSocket(url);
    socket.addEventListener("open", () => { connected.value = true; attempts = 0; });
    socket.addEventListener("message", (message) => {
      try {
        const parsed: unknown = JSON.parse(String(message.data));
        if (isOverlayEvent(parsed)) onEvent(parsed);
      } catch { /* Ignore malformed network payloads. */ }
    });
    socket.addEventListener("close", scheduleReconnect);
    socket.addEventListener("error", () => socket?.close());
  };

  const scheduleReconnect = (): void => {
    connected.value = false;
    const delay = Math.min(500 * (2 ** attempts), maxReconnectDelay);
    attempts += 1;
    reconnectTimer = setTimeout(connect, delay);
  };

  connect();
  onBeforeUnmount(() => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
  });

  return { connected, status };
}
