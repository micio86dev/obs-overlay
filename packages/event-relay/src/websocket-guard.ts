/** Limits protect a public OBS endpoint from slow-consumer memory growth; they are not authentication. */
export const MAX_WEBSOCKET_CLIENTS = 100;
export const MAX_WEBSOCKET_BUFFERED_BYTES = 256 * 1024;

export interface RelayWebSocketClient {
  bufferedAmount: number;
  send(payload: string): void;
  terminate(): void;
}

export interface RelayConnectionClient { close(code: number, reason: string): void; }

/** Terminates slow consumers instead of letting queued relay snapshots grow unbounded. */
export function sendRelayPayload(client: RelayWebSocketClient, payload: string): boolean {
  if (client.bufferedAmount + Buffer.byteLength(payload, "utf8") > MAX_WEBSOCKET_BUFFERED_BYTES) {
    client.terminate();
    return false;
  }
  client.send(payload);
  return true;
}

export function admitRelayConnection(clientCount: number, client: RelayConnectionClient): boolean {
  if (clientCount <= MAX_WEBSOCKET_CLIENTS) return true;
  client.close(1013, "Relay connection limit reached");
  return false;
}
