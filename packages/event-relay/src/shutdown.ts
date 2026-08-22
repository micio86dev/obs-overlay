export interface RelayClient {
  close(code?: number, reason?: string): void;
  terminate(): void;
}

export interface RelayShutdownResources {
  stopSource(): void;
  clients: Iterable<RelayClient>;
  closeWebSocketServer(done: () => void): void;
  closeHttpServer(done: () => void): void;
  forceCloseHttpConnections(): void;
}

/** Closes a relay without allowing unresponsive clients to keep it alive indefinitely. */
export function gracefulShutdownRelay(resources: RelayShutdownResources, graceMs = 1_000): Promise<void> {
  return new Promise((resolve) => {
    let remainingClosures = 2;
    let settled = false;
    const clients = [...resources.clients];
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(forceTimer);
      resolve();
    };
    const closed = (): void => {
      remainingClosures -= 1;
      if (remainingClosures === 0) finish();
    };
    const forceTimer = setTimeout(() => {
      if (settled) return;
      clients.forEach((client) => client.terminate());
      resources.forceCloseHttpConnections();
      finish();
    }, graceMs);

    resources.stopSource();
    clients.forEach((client) => client.close(1001, "Server shutting down"));
    try {
      resources.closeWebSocketServer(closed);
    } catch {
      closed();
    }
    try {
      resources.closeHttpServer(closed);
    } catch {
      closed();
    }
  });
}
