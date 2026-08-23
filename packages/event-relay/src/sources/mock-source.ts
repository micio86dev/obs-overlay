import type { LiveState, OverlayEvent, OverlayEventType } from "@miciodev/shared-types";
import { createMockEvent, demoEventTypes } from "@miciodev/shared-types/mock";

export type EventListener = (event: OverlayEvent) => void;

export type LiveStateListener = (state: Omit<LiveState, "session">) => void;

export interface EventSource {
  start(): void;
  stop(): void;
  subscribe(listener: EventListener): () => void;
}

export class MockSource implements EventSource {
  private listeners = new Set<EventListener>();
  private stateListeners = new Set<LiveStateListener>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private sequence = 0;
  private running = false;
  private readonly broadcastId = "mock-broadcast";
  private readonly eventTypes: OverlayEventType[] = demoEventTypes;

  public constructor(private readonly intervalMs = 8_000) {}

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public subscribeState(listener: LiveStateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /** A scripted lifecycle so the shared status bar is exercisable without YouTube credentials. */
  private emitState(): void {
    const tick = this.sequence;
    const startedAt = new Date(Date.now() - tick * this.intervalMs).toISOString();
    const state: Omit<LiveState, "session"> = tick < 2
      ? { broadcastId: this.broadcastId, status: "upcoming", scheduledStartAt: new Date(Date.now() + 90_000).toISOString() }
      : { broadcastId: this.broadcastId, status: "live", startedAt, concurrentViewers: 40 + tick * 7, subscriberCount: 1_180 + tick * 3, streamHealth: tick % 11 === 0 ? "warning" : "good" };
    this.stateListeners.forEach((listener) => listener(state));
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.emitNext();
    this.timer = setInterval(() => this.emitNext(), this.intervalMs);
  }

  public stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  public emitNext(): void {
    const type = this.eventTypes[this.sequence % this.eventTypes.length];
    this.sequence += 1;
    const event = createMockEvent(type, this.sequence);
    this.emitState();
    this.listeners.forEach((listener) => listener(event));
  }
}
