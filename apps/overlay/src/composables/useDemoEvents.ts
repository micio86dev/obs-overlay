import { onBeforeUnmount } from "vue";
import { createMockEvent, type OverlayEventType } from "@miciodev/shared-types";

export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE !== "false";
}

export function useDemoEvents(onEvent: (event: ReturnType<typeof createMockEvent>) => void) {
  let sequence = 0;
  const timer = setInterval(() => {
    const types: OverlayEventType[] = ["chat", "subscriber", "superchat"];
    onEvent(createMockEvent(types[sequence % types.length], sequence + 1));
    sequence += 1;
  }, 5_500);

  onBeforeUnmount(() => clearInterval(timer));
}
