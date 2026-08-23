import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { MAX_WEBSOCKET_BUFFERED_BYTES, admitRelayConnection, sendRelayPayload } from "../src/websocket-guard.ts";

test("sends to healthy clients and terminates clients that exceed the bounded send buffer", () => {
  const healthy = { bufferedAmount: MAX_WEBSOCKET_BUFFERED_BYTES - Buffer.byteLength("state"), sendCalls: 0, terminated: false, send() { this.sendCalls += 1; }, terminate() { this.terminated = true; } };
  const slow = { bufferedAmount: MAX_WEBSOCKET_BUFFERED_BYTES - 1, sendCalls: 0, terminated: false, send() { this.sendCalls += 1; }, terminate() { this.terminated = true; } };
  assert.equal(sendRelayPayload(healthy, "state"), true);
  assert.equal(healthy.sendCalls, 1);
  assert.equal(sendRelayPayload(slow, "é"), false); // Two UTF-8 bytes would cross the cap.
  assert.equal(slow.sendCalls, 0);
  assert.equal(slow.terminated, true);
});

test("the 101st real WebSocket connection is rejected with 1013", async () => {
  const server = createServer();
  const websocketServer = new WebSocketServer({ server });
  websocketServer.on("connection", (client) => { admitRelayConnection(websocketServer.clients.size, client); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP server address");
  const clients: WebSocket[] = [];
  try {
    await Promise.all(Array.from({ length: 100 }, async () => {
      const client = new WebSocket(`ws://127.0.0.1:${address.port}`);
      clients.push(client);
      await new Promise<void>((resolve, reject) => { client.once("open", resolve); client.once("error", reject); });
    }));
    const overflow = new WebSocket(`ws://127.0.0.1:${address.port}`);
    const code = await new Promise<number>((resolve, reject) => { overflow.once("close", resolve); overflow.once("error", reject); });
    assert.equal(code, 1013);
  } finally {
    clients.forEach((client) => client.terminate());
    await new Promise<void>((resolve) => websocketServer.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
