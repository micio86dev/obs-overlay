import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { WebSocketServer } from "ws";
import type { OverlayEvent } from "@miciodev/shared-types";
import { parseBoundedInteger } from "./config.js";
import { gracefulShutdownRelay } from "./shutdown.js";
import { MockSource, type EventSource } from "./sources/mock-source.js";
import { YouTubeSource } from "./sources/youtube-source.js";

function loadDotenv(): void {
  const file = resolve(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

loadDotenv();
const port = parseBoundedInteger(process.env.PORT, { name: "PORT", fallback: 8787, minimum: 1, maximum: 65_535 });
const host = process.env.HOST || "127.0.0.1";
const sourceName = process.env.EVENT_SOURCE ?? "mock";
const mockIntervalMs = parseBoundedInteger(process.env.MOCK_INTERVAL_MS, { name: "MOCK_INTERVAL_MS", fallback: 8_000, minimum: 1_000, maximum: 60_000 });

function createSource(): EventSource {
  if (sourceName === "mock") return new MockSource(mockIntervalMs);
  if (sourceName === "youtube") {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const liveChatId = process.env.YOUTUBE_LIVE_CHAT_ID;
    if (!apiKey || !liveChatId) throw new Error("YOUTUBE_API_KEY and YOUTUBE_LIVE_CHAT_ID are required for EVENT_SOURCE=youtube");
    return new YouTubeSource(apiKey, liveChatId, Number(process.env.POLL_INTERVAL_MS ?? 10_000));
  }
  throw new Error(`Unsupported EVENT_SOURCE: ${sourceName}. Use mock or youtube.`);
}

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", source: sourceName }));
    return;
  }
  response.writeHead(404);
  response.end();
});

const websocketServer = new WebSocketServer({ server, path: "/events" });
const source = createSource();
source.subscribe((event: OverlayEvent) => {
  const message = JSON.stringify(event);
  websocketServer.clients.forEach((client) => {
    if (client.readyState === client.OPEN) client.send(message);
  });
});
source.start();

server.listen(port, host, () => console.log(`Event relay (${sourceName}) listening on http://${host}:${port}`));

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await gracefulShutdownRelay({
    stopSource: () => source.stop(),
    clients: websocketServer.clients,
    closeWebSocketServer: (done) => websocketServer.close(() => done()),
    closeHttpServer: (done) => server.close(() => done()),
    forceCloseHttpConnections: () => server.closeAllConnections(),
  });
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
