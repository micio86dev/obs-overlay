import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { WebSocketServer } from "ws";
import type { OverlayEvent } from "@miciodev/shared-types";
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
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST || "127.0.0.1";
const sourceName = process.env.EVENT_SOURCE ?? "mock";

function createSource(): EventSource {
  if (sourceName === "mock") return new MockSource(Number(process.env.MOCK_INTERVAL_MS ?? 8_000));
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
function shutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  source.stop();
  websocketServer.clients.forEach((client) => client.close(1001, "Server shutting down"));
  websocketServer.close();
  server.close();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
