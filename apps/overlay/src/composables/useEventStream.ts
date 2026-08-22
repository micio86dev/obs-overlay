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
  let disposed = false;

  const url = import.meta.env.VITE_RELAY_URL ?? "ws://localhost:8787/events";

  const connect = (): void => {
    if (disposed) return;
    const nextSocket = new WebSocket(url);
    socket = nextSocket;
    nextSocket.addEventListener("open", () => {
      if (disposed || socket !== nextSocket) return;
      connected.value = true;
      attempts = 0;
    });
    nextSocket.addEventListener("message", (message) => {
      try {
        const parsed: unknown = JSON.parse(String(message.data));
        if (!disposed && isOverlayEvent(parsed)) onEvent(parsed);
      } catch { /* Ignore malformed network payloads. */ }
    });
    nextSocket.addEventListener("close", () => {
      if (socket === nextSocket) scheduleReconnect();
    });
    nextSocket.addEventListener("error", () => nextSocket.close());
  };

  const scheduleReconnect = (): void => {
    if (disposed || reconnectTimer) return;
    connected.value = false;
    const delay = Math.min(500 * (2 ** attempts), maxReconnectDelay);
    attempts += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, delay);
  };

  connect();
  onBeforeUnmount(() => {
    disposed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    socket?.close();
  });

  return { connected, status };
}
