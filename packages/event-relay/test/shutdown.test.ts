import assert from "node:assert/strict";
import test from "node:test";
import { gracefulShutdownRelay } from "../src/shutdown.ts";

test("gracefulShutdownRelay closes clients and completes normally when both servers close", async () => {
  const calls: string[] = [];
  await gracefulShutdownRelay({
    stopSource: () => calls.push("source"),
    clients: [{ close: () => calls.push("close"), terminate: () => calls.push("terminate") }],
    closeWebSocketServer: (done) => { calls.push("wss"); done(); },
    closeHttpServer: (done) => { calls.push("http"); done(); },
    forceCloseHttpConnections: () => calls.push("force-http"),
  }, 10);

  assert.deepEqual(calls, ["source", "close", "wss", "http"]);
});

test("gracefulShutdownRelay terminates stuck websocket clients and resolves at its grace bound", async () => {
  const calls: string[] = [];
  await gracefulShutdownRelay({
    stopSource: () => calls.push("source"),
    clients: [{ close: () => calls.push("close"), terminate: () => calls.push("terminate") }],
    closeWebSocketServer: () => calls.push("wss"),
    closeHttpServer: () => calls.push("http"),
    forceCloseHttpConnections: () => calls.push("force-http"),
  }, 1);

  assert.deepEqual(calls, ["source", "close", "wss", "http", "terminate", "force-http"]);
});
