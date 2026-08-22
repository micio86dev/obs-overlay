import { createMockEvent, type OverlayEvent, type OverlayEventType } from "@miciodev/shared-types";

export type EventListener = (event: OverlayEvent) => void;

export interface EventSource {
  start(): void;
  stop(): void;
  subscribe(listener: EventListener): () => void;
}

export class MockSource implements EventSource {
  private listeners = new Set<EventListener>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private sequence = 0;
  private running = false;
  private readonly eventTypes: OverlayEventType[] = ["chat", "subscriber", "superchat"];

  public constructor(private readonly intervalMs = 8_000) {}

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
    this.listeners.forEach((listener) => listener(event));
  }
}
