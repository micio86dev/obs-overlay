import type { IncomingMessage, ServerResponse } from "node:http";
import type { QuizGame } from "./quiz-game.js";

export type QuizRequestHandler = (request: IncomingMessage, response: ServerResponse) => boolean;

function setQuizCorsHeaders(response: ServerResponse): void {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET, OPTIONS");
}

/** Exposes only the seeded question bank for the separately hosted static overlay. */
export function createQuizRequestHandler(game: QuizGame): QuizRequestHandler {
  return (request, response): boolean => {
    const path = new URL(request.url ?? "/", "http://relay.local").pathname;
    if (path !== "/quiz/state") return false;

    setQuizCorsHeaders(response);
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return true;
    }
    if (request.method !== "GET") {
      response.writeHead(405, { allow: "GET, OPTIONS" });
      response.end();
      return true;
    }

    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(JSON.stringify(game.state));
    return true;
  };
}
