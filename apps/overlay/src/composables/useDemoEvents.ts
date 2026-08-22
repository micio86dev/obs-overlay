import { onBeforeUnmount } from "vue";
import { createMockEvent, type OverlayEventType } from "@miciodev/shared-types";

export function useDemoEvents(onEvent: (event: ReturnType<typeof createMockEvent>) => void) {
  const enabled = import.meta.env.VITE_DEMO_MODE !== "false";
  let sequence = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  if (enabled) {
    timer = setInterval(() => {
      const types: OverlayEventType[] = ["chat", "subscriber", "superchat"];
      onEvent(createMockEvent(types[sequence % types.length], sequence + 1));
      sequence += 1;
    }, 5_500);
  }
  onBeforeUnmount(() => { if (timer) clearInterval(timer); });
  return { enabled };
}
