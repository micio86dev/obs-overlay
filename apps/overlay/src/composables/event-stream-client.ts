import type { OverlayEvent } from "@miciodev/shared-types";
import { isOverlayEvent } from "@miciodev/shared-types";

const maxReconnectDelay = 10_000;

export type SocketFactory = (url: string) => WebSocket;

export class EventStreamClient {
  private socket: WebSocket | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private attempts = 0;
  private disposed = false;

  public constructor(
    private readonly url: string,
    private readonly onEvent: (event: OverlayEvent) => void,
    private readonly onConnectionChange: (connected: boolean) => void,
    private readonly createSocket: SocketFactory = (url) => new WebSocket(url),
  ) {}

  public start(): void {
    this.disposed = false;
    this.connect();
  }

  public stop(): void {
    this.disposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.socket?.close();
    this.socket = undefined;
    this.onConnectionChange(false);
  }

  private connect(): void {
    if (this.disposed) return;
    let nextSocket: WebSocket;
    try {
      nextSocket = this.createSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = nextSocket;
    nextSocket.addEventListener("open", () => {
      if (this.disposed || this.socket !== nextSocket) return;
      this.onConnectionChange(true);
      this.attempts = 0;
    });
    nextSocket.addEventListener("message", (message) => {
      try {
        const parsed: unknown = JSON.parse(String(message.data));
        if (!this.disposed && isOverlayEvent(parsed)) this.onEvent(parsed);
      } catch { /* Ignore malformed network payloads. */ }
    });
    nextSocket.addEventListener("close", () => {
      if (this.socket === nextSocket) this.scheduleReconnect();
    });
    nextSocket.addEventListener("error", () => nextSocket.close());
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimer) return;
    this.onConnectionChange(false);
    const delay = Math.min(500 * (2 ** this.attempts), maxReconnectDelay);
    this.attempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, delay);
  }
}
