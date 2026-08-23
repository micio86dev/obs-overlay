import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import type { LiveState, OverlayEvent, RelayMessage } from "@miciodev/shared-types";
import { loadDotenv, parseBoundedInteger } from "./config.js";
import { ParticipantIdentityMapper } from "./participant-identity.js";
import { LiveSessionTracker } from "./live-state.js";
import { createQuizRequestHandler } from "./quiz-api.js";
import { QuizGame } from "./quiz-game.js";
import { openQuizQuestionRepository } from "./quiz-repository.js";
import { gracefulShutdownRelay } from "./shutdown.js";
import { createEventSource } from "./source-selection.js";
import { StateBroadcastCoalescer } from "./state-broadcast.js";
import { admitRelayConnection, sendRelayPayload } from "./websocket-guard.js";

loadDotenv();
const port = parseBoundedInteger(process.env.PORT, { name: "PORT", fallback: 8787, minimum: 1, maximum: 65_535 });
const host = process.env.HOST || "127.0.0.1";
const sourceName = process.env.EVENT_SOURCE ?? "none";
const mockIntervalMs = parseBoundedInteger(process.env.MOCK_INTERVAL_MS, { name: "MOCK_INTERVAL_MS", fallback: 8_000, minimum: 1_000, maximum: 60_000 });
const pollIntervalMs = parseBoundedInteger(process.env.POLL_INTERVAL_MS, { name: "POLL_INTERVAL_MS", fallback: 10_000, minimum: 1_000, maximum: 60_000 });
// 0 disables the guard. The default YouTube project allowance is 10,000 units/day.
const dailyQuotaUnits = parseBoundedInteger(process.env.YOUTUBE_DAILY_QUOTA_UNITS, { name: "YOUTUBE_DAILY_QUOTA_UNITS", fallback: 10_000, minimum: 0, maximum: 100_000_000 });
const quizRepository = openQuizQuestionRepository();
const participantIds = new ParticipantIdentityMapper();
const liveSession = new LiveSessionTracker();
const quizGame = new QuizGame({ questions: quizRepository.listQuestions(), onRoundStart: () => participantIds.startRound() });
quizGame.start();
const handleQuizRequest = createQuizRequestHandler(quizGame);

const server = createServer((request, response) => {
  if (handleQuizRequest(request, response)) return;
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", source: sourceName }));
    return;
  }
  response.writeHead(404);
  response.end();
});

const maxWebSocketPayloadBytes = 16 * 1024;
const websocketServer = new WebSocketServer({ server, path: "/events", maxPayload: maxWebSocketPayloadBytes });
const source = createEventSource({
  sourceName,
  mockSourceEnabled: process.env.MOCK_SOURCE_ENABLED,
  mockIntervalMs,
  youtubeApiKey: process.env.YOUTUBE_API_KEY,
  youtubeLiveChatId: process.env.YOUTUBE_LIVE_CHAT_ID,
  youtubeChannelHandle: process.env.YOUTUBE_CHANNEL_HANDLE,
  pollIntervalMs,
  dailyQuotaUnits,
});
function broadcast(message: RelayMessage): void {
  const payload = JSON.stringify(message);
  if (Buffer.byteLength(payload, "utf8") > maxWebSocketPayloadBytes) {
    console.warn("Skipping oversized relay WebSocket payload");
    return;
  }
  websocketServer.clients.forEach((client) => {
    if (client.readyState === client.OPEN) sendRelayPayload(client, payload);
  });
}

websocketServer.on("connection", (client) => {
  if (!admitRelayConnection(websocketServer.clients.size, client)) return;
  if (client.readyState === client.OPEN) {
    const payload = JSON.stringify({ kind: "state", state: liveSession.snapshot } satisfies RelayMessage);
    if (Buffer.byteLength(payload, "utf8") <= maxWebSocketPayloadBytes) sendRelayPayload(client, payload);
  }
});

// A busy chat must not push one full state snapshot per message.
const stateBroadcast = new StateBroadcastCoalescer((state) => broadcast({ kind: "state", state }));

source.subscribe((event: OverlayEvent) => {
  const publicEvent = participantIds.map(event);
  if (publicEvent.type === "chat") quizGame.submit(publicEvent);
  liveSession.record(publicEvent);
  broadcast({ kind: "event", event: publicEvent });
  stateBroadcast.push(liveSession.snapshot);
});
interface StateCapableEventSource { subscribeState(listener: (state: Omit<LiveState, "session">) => void): () => void; }
function supportsLiveState(value: unknown): value is StateCapableEventSource {
  if (!value || typeof value !== "object" || !("subscribeState" in value)) return false;
  return typeof value.subscribeState === "function";
}
if (supportsLiveState(source)) source.subscribeState((state) => {
  liveSession.update(state);
  stateBroadcast.push(liveSession.snapshot);
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
  stateBroadcast.dispose();
  quizGame.stop();
  quizRepository.close();
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
