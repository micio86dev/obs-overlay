import assert from "node:assert/strict";
import test from "node:test";
import type { ChatEvent } from "@miciodev/shared-types";
import { QuizGame, type QuizScheduler } from "../src/quiz-game.js";
import { ParticipantIdentityMapper } from "../src/participant-identity.js";
import type { PythonQuestion } from "../src/quiz/question-bank.js";

class FakeScheduler implements QuizScheduler {
  public nowMs = 0;
  private callback: (() => void) | undefined;
  public now(): number { return this.nowMs; }
  public setTimeout(callback: () => void): number { this.callback = callback; return 1; }
  public clearTimeout(): void { this.callback = undefined; }
  public advance(milliseconds: number): void { this.nowMs += milliseconds; const callback = this.callback; this.callback = undefined; callback?.(); }
}

const questions: readonly PythonQuestion[] = Array.from({ length: 10 }, (_, index) => ({
  id: `python-${index + 1}`,
  prompt: `Question ${index + 1}`,
  options: ["one", "two", "three", "four"],
  correctOption: 2,
  difficulty: "facile",
}));

function chat(authorId: string, message: string, avatarUrl?: string): ChatEvent {
  return { id: `${authorId}-${message}`, type: "chat", author: authorId, authorId, avatarUrl, message, occurredAt: "2026-08-22T00:00:00.000Z" };
}

test("does not disclose answers until the server-owned question deadline and caps participants", () => {
  const scheduler = new FakeScheduler();
  const game = new QuizGame({ questions, scheduler, random: () => 0, maxParticipants: 1, questionDurationMs: 30_000, resultsDurationMs: 1_000, finalDurationMs: 1_000 });
  game.start();

  assert.equal(game.state.question.options.length, 4);
  assert.equal("correctOption" in game.state.question, false);
  assert.equal(game.submit(chat("opaque-a", "2")), true);
  assert.equal(game.submit(chat("opaque-b", "2")), false);

  scheduler.advance(30_000);
  assert.equal(game.state.phase, "results");
  assert.equal(game.state.result?.correctOption, 2);
  assert.equal(game.state.result?.responses[1].count, 1);
});

test("carries each player's avatar from chat into the leaderboard", () => {
  const scheduler = new FakeScheduler();
  const game = new QuizGame({ questions, scheduler, random: () => 0, questionDurationMs: 30_000, resultsDurationMs: 1_000, finalDurationMs: 1_000 });
  game.start();

  game.submit(chat("opaque-a", "2", "https://yt3.example/a.jpg"));
  scheduler.advance(30_000);

  assert.equal(game.state.leaderboard[0]?.avatarUrl, "https://yt3.example/a.jpg");
});

test("keeps the first known avatar rather than dropping it when a later message omits one", () => {
  const scheduler = new FakeScheduler();
  const game = new QuizGame({ questions, scheduler, random: () => 0, questionDurationMs: 30_000, resultsDurationMs: 1_000, finalDurationMs: 1_000 });
  game.start();

  game.submit(chat("opaque-a", "2", "https://yt3.example/a.jpg"));
  scheduler.advance(30_000);
  scheduler.advance(1_000);
  game.submit(chat("opaque-a", "2"));
  scheduler.advance(30_000);

  assert.equal(game.state.leaderboard[0]?.avatarUrl, "https://yt3.example/a.jpg");
});

test("an evicted provider identity cannot submit twice during the active round", () => {
  const scheduler = new FakeScheduler();
  const game = new QuizGame({ questions, scheduler, random: () => 0, maxParticipants: 2, questionDurationMs: 30_000 });
  const mapper = new ParticipantIdentityMapper(1);
  game.start();
  const first = mapper.map(chat("UC-one", "2"));
  mapper.map(chat("UC-two", "1"));

  assert.equal(game.submit(first as ChatEvent), true);
  assert.equal(game.submit(mapper.map(chat("UC-one", "3")) as ChatEvent), false);
});
