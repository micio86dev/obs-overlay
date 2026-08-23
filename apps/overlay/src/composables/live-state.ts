import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from "vue";
import { createEmptySessionMetrics, type LiveState } from "@miciodev/shared-types";

const emptyState: LiveState = { status: "unknown", session: createEmptySessionMetrics() };

export function mergeLiveState(current: LiveState, incoming: LiveState): LiveState {
  const isNewBroadcast = incoming.broadcastId !== undefined && incoming.broadcastId !== current.broadcastId;
  if (incoming.status === "offline" || isNewBroadcast) return incoming;
  return { ...current, ...incoming, session: incoming.session };
}

/** Utility alias, not an object shape: an empty extending interface is banned by lint. */
type ClockState = Pick<LiveState, "status" | "startedAt" | "endedAt" | "scheduledStartAt">;

export function formatLiveTime(state: ClockState, now = Date.now()): string | undefined {
  const start = state.status === "upcoming" ? state.scheduledStartAt : state.startedAt;
  if (!start) return undefined;
  const startTime = Date.parse(start);
  const endTime = state.status === "complete" && state.endedAt ? Date.parse(state.endedAt) : now;
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return undefined;
  const elapsedMs = state.status === "upcoming" ? startTime - now : endTime - startTime;
  const seconds = Math.max(0, Math.floor(elapsedMs / 1_000));
  const hours = Math.floor(seconds / 3_600).toString().padStart(2, "0");
  const minutes = Math.floor((seconds % 3_600) / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${remainder}`;
}

/** One browser-local clock; it never calls YouTube and is disposed with the overlay. */
export function useLiveClock(state: Ref<LiveState>): ComputedRef<string | undefined> {
  const now = ref(Date.now());
  const timer = setInterval(() => { now.value = Date.now(); }, 1_000);
  onBeforeUnmount(() => clearInterval(timer));
  return computed(() => formatLiveTime(state.value, now.value));
}

export function createInitialLiveState(): LiveState {
  return { ...emptyState, session: createEmptySessionMetrics() };
}
