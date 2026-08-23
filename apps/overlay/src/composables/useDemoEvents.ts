import { onBeforeUnmount, ref, type Ref } from "vue";
import { createEmptySessionMetrics, recordSessionMetrics, type LiveState, type OverlayEvent } from "@miciodev/shared-types";
import { createMockEvent, demoEventTypes } from "@miciodev/shared-types/mock";
import { demoLiveState } from "./demo-live-state";

export function isDemoMode(value = import.meta.env.VITE_DEMO_MODE): boolean {
  // A ?demo=true query param forces demo mode regardless of how this build was configured — the
  // composite preview page uses it so it can show demo content over a live production deploy.
  if (new URLSearchParams(window.location.search).get("demo") === "true") return true;
  return value !== "false";
}

export interface DemoEvents { liveState: Ref<LiveState> }

/** Browser-only preview. It opens no socket and never reaches YouTube. */
export function useDemoEvents(onEvent: (event: OverlayEvent) => void): DemoEvents {
  const liveState = ref<LiveState>({ ...demoLiveState(0, Date.now()), session: createEmptySessionMetrics() });
  let sequence = 0;

  const timer = setInterval(() => {
    const event = createMockEvent(demoEventTypes[sequence % demoEventTypes.length], sequence + 1);
    sequence += 1;
    liveState.value = { ...demoLiveState(sequence, Date.now()), session: recordSessionMetrics(liveState.value.session, event) };
    onEvent(event);
  }, 5_500);

  onBeforeUnmount(() => clearInterval(timer));
  return { liveState };
}
