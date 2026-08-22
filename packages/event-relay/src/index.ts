import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { WebSocketServer } from "ws";
import type { OverlayEvent } from "@miciodev/shared-types";
import { parseBoundedInteger } from "./config.js";
import { ParticipantIdentityMapper } from "./participant-identity.js";
import { createQuizRequestHandler } from "./quiz-api.js";
import { QuizGame } from "./quiz-game.js";
import { openQuizQuestionRepository } from "./quiz-repository.js";
import { gracefulShutdownRelay } from "./shutdown.js";
import { createEventSource } from "./source-selection.js";

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
const sourceName = process.env.EVENT_SOURCE ?? "none";
const mockIntervalMs = parseBoundedInteger(process.env.MOCK_INTERVAL_MS, { name: "MOCK_INTERVAL_MS", fallback: 8_000, minimum: 1_000, maximum: 60_000 });
const quizRepository = openQuizQuestionRepository();
const participantIds = new ParticipantIdentityMapper();
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

const websocketServer = new WebSocketServer({ server, path: "/events" });
const source = createEventSource({
  sourceName,
  mockSourceEnabled: process.env.MOCK_SOURCE_ENABLED,
  mockIntervalMs,
  youtubeApiKey: process.env.YOUTUBE_API_KEY,
  youtubeLiveChatId: process.env.YOUTUBE_LIVE_CHAT_ID,
  youtubeChannelHandle: process.env.YOUTUBE_CHANNEL_HANDLE,
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 10_000),
});
source.subscribe((event: OverlayEvent) => {
  const publicEvent = participantIds.map(event);
  if (publicEvent.type === "chat") quizGame.submit(publicEvent);
  const message = JSON.stringify(publicEvent);
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
  quizGame.stop();
  quizRepository.close();
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
