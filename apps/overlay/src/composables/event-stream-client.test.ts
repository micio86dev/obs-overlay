import { afterEach, describe, expect, it, vi } from "vitest";
import type { OverlayEvent } from "@miciodev/shared-types";
import { EventStreamClient } from "./event-stream-client";

class FakeWebSocket extends EventTarget {
  public close = vi.fn();

  public emitMessage(data: string): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }

  public emitClose(): void {
    this.dispatchEvent(new Event("close"));
  }
}

describe("EventStreamClient", () => {
  afterEach(() => vi.useRealTimers());

  it("retries a malformed relay URL instead of throwing synchronously", () => {
    vi.useFakeTimers();
    const createSocket = vi.fn(() => { throw new SyntaxError("Invalid URL"); });
    const client = new EventStreamClient("not a websocket URL", vi.fn(), vi.fn(), createSocket);

    expect(() => client.start()).not.toThrow();
    expect(createSocket).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(createSocket).toHaveBeenCalledTimes(2);
    client.stop();
  });

  it("opens only one socket when start is called repeatedly", () => {
    const createSocket = vi.fn(() => new FakeWebSocket() as unknown as WebSocket);
    const client = new EventStreamClient("ws://relay.test/events", vi.fn(), vi.fn(), createSocket);

    client.start();
    client.start();

    expect(createSocket).toHaveBeenCalledTimes(1);
    client.stop();
  });

  it("forwards only normalized overlay events and stops reconnecting after disposal", () => {
    vi.useFakeTimers();
    const socket = new FakeWebSocket();
    const received: OverlayEvent[] = [];
    const client = new EventStreamClient("ws://relay.test/events", (event) => received.push(event), vi.fn(), () => socket as unknown as WebSocket);
    client.start();

    socket.emitMessage(JSON.stringify({ id: "bad", type: "chat" }));
    socket.emitMessage(JSON.stringify({ id: "chat-1", type: "chat", occurredAt: "2026-08-22T00:00:00.000Z", author: "MicioFan", message: "hello" }));
    expect(received).toHaveLength(1);

    socket.emitClose();
    client.stop();
    vi.advanceTimersByTime(10_000);
    expect(socket.close).toHaveBeenCalledTimes(1);
  });

  it("accepts a fresh state snapshot after reconnect without treating it as an event", () => {
    const socket = new FakeWebSocket();
    const states: unknown[] = [];
    const received: OverlayEvent[] = [];
    const client = new EventStreamClient("ws://relay.test/events", (event) => received.push(event), vi.fn(), () => socket as unknown as WebSocket, (state) => states.push(state));
    client.start();
    socket.emitMessage(JSON.stringify({ kind: "state", state: { status: "live", broadcastId: "video-1", concurrentViewers: 15, peakViewers: 15, session: { chatMessages: 1, superChatCount: 0, superStickerCount: 0, newMembers: 0, giftedMemberships: 0, superChatRevenueMicros: {} } } }));
    expect(states).toHaveLength(1);
    expect(received).toHaveLength(0);
    client.stop();
  });
});
