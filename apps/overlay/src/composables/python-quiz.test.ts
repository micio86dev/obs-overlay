import { describe, expect, it } from "vitest";
import type { ChatEvent } from "@miciodev/shared-types";
import { BoundedEventIdSet, PythonQuiz, validatePythonQuizConfig, type QuizScheduler } from "./python-quiz";
import { pythonQuestionBank } from "../data/python-question-bank";

class FakeScheduler implements QuizScheduler {
  public nowMs = 0;
  private nextId = 1;
  private readonly tasks = new Map<number, { dueAt: number; callback: () => void }>();

  public now(): number { return this.nowMs; }
  public setTimeout(callback: () => void, delayMs: number): number {
    const id = this.nextId;
    this.nextId += 1;
    this.tasks.set(id, { dueAt: this.nowMs + delayMs, callback });
    return id;
  }
  public clearTimeout(handle: number): void { this.tasks.delete(handle); }
  public elapseWithoutRunning(delayMs: number): void { this.nowMs += delayMs; }
  public advanceBy(delayMs: number): void {
    const target = this.nowMs + delayMs;
    while (true) {
      const next = [...this.tasks.entries()]
        .filter(([, task]) => task.dueAt <= target)
        .sort(([, left], [, right]) => left.dueAt - right.dueAt)[0];
      if (!next) break;
      const [id, task] = next;
      this.tasks.delete(id);
      this.nowMs = task.dueAt;
      task.callback();
    }
    this.nowMs = target;
  }
}

function chat(author: string, message: string, authorId?: string): ChatEvent {
  return { id: `${author}-${message}`, type: "chat", author, authorId, message, occurredAt: "2026-08-22T00:00:00.000Z" };
}

describe("python question bank", () => {
  it("ships exactly one hundred numbered four-option questions", () => {
    expect(pythonQuestionBank).toHaveLength(100);
    expect(new Set(pythonQuestionBank.map((question) => question.id)).size).toBe(100);
    expect(pythonQuestionBank.every((question) => question.options.length === 4 && question.correctOption >= 1 && question.correctOption <= 4)).toBe(true);
  });

  it("keeps control-flow and join-method facts accurate", () => {
    const whileQuestion = pythonQuestionBank.find((question) => question.id === "python-75");
    const joinQuestion = pythonQuestionBank.find((question) => question.id === "python-99");
    expect(whileQuestion).toMatchObject({ prompt: "A while loop keeps running while its condition evaluates to:", correctOption: 1, options: expect.arrayContaining(["True"]) });
    expect(joinQuestion).toMatchObject({ prompt: "Which string method can combine an iterable into a string?", options: expect.arrayContaining(["join"]) });
  });
});

describe("PythonQuiz", () => {
  it("rejects invalid quiz configuration boundaries", () => {
    expect(() => validatePythonQuizConfig({ questionCount: 0, questionDurationMs: 30_000, resultsDurationMs: 8_000, finalDurationMs: 15_000 }, 100)).toThrow(/questionCount/);
    expect(() => validatePythonQuizConfig({ questionCount: 1.5, questionDurationMs: 30_000, resultsDurationMs: 8_000, finalDurationMs: 15_000 }, 100)).toThrow(/questionCount/);
    expect(() => validatePythonQuizConfig({ questionCount: 101, questionDurationMs: 30_000, resultsDurationMs: 8_000, finalDurationMs: 15_000 }, 100)).toThrow(/questionCount/);
    expect(() => validatePythonQuizConfig({ questionCount: 10, questionDurationMs: 999, resultsDurationMs: 8_000, finalDurationMs: 15_000 }, 100)).toThrow(/questionDurationMs/);
    expect(() => validatePythonQuizConfig({ questionCount: 10, questionDurationMs: 30_000, resultsDurationMs: 0, finalDurationMs: 15_000 }, 100)).toThrow(/resultsDurationMs/);
    expect(validatePythonQuizConfig({ questionCount: 10, questionDurationMs: 30_000, resultsDurationMs: 8_000, finalDurationMs: 15_000 }, 100)).toMatchObject({ questionCount: 10 });
  });

  it("bounds processed event IDs while preserving deduplication inside the window", () => {
    const ids = new BoundedEventIdSet(2);
    expect(ids.add("first")).toBe(true);
    expect(ids.add("first")).toBe(false);
    expect(ids.add("second")).toBe(true);
    expect(ids.add("third")).toBe(true);
    expect(ids.size).toBe(2);
    expect(ids.add("first")).toBe(true);
  });

  it("accepts only a viewer's first exact numeric answer and uses authorId for identity", () => {
    const scheduler = new FakeScheduler();
    const quiz = new PythonQuiz({ questions: pythonQuestionBank, scheduler, random: () => 0, questionCount: 2 });
    quiz.start();

    expect(quiz.submit(chat("Same display name", " 2 ", "channel-a"))).toBe(true);
    expect(quiz.submit(chat("Same display name", "1", "channel-a"))).toBe(false);
    expect(quiz.submit(chat("Same display name", "1", "channel-b"))).toBe(true);
    expect(quiz.submit(chat("Ignored", "2 please", "channel-c"))).toBe(false);
    expect(quiz.state.responses.reduce((total, response) => total + response.count, 0)).toBe(2);
    expect(quiz.state.questionLeaderboard.map((player) => player.playerId)).toEqual(["channel-a", "channel-b"]);
  });

  it("rejects an answer submitted at the deadline before a delayed timer callback runs", () => {
    const scheduler = new FakeScheduler();
    const quiz = new PythonQuiz({ questions: pythonQuestionBank, scheduler, random: () => 0, questionCount: 1 });
    quiz.start();
    scheduler.elapseWithoutRunning(30_000);

    expect(quiz.state.phase).toBe("question");
    expect(quiz.submit(chat("Late viewer", "1", "channel-late"))).toBe(false);
    expect(quiz.state.responses.every((response) => response.count === 0)).toBe(true);
  });

  it("runs question, result, final leaderboard, and then starts a fresh game autonomously", () => {
    const scheduler = new FakeScheduler();
    const quiz = new PythonQuiz({
      questions: pythonQuestionBank,
      scheduler,
      random: () => 0,
      questionCount: 2,
      questionDurationMs: 30_000,
      resultsDurationMs: 8_000,
      finalDurationMs: 15_000,
    });
    quiz.start();
    const firstQuestionId = quiz.state.question.id;
    quiz.submit(chat("MicioFan", String(quiz.state.question.correctOption), "viewer-1"));

    scheduler.advanceBy(30_000);
    expect(quiz.state.phase).toBe("results");
    expect(quiz.state.questionLeaderboard[0]).toMatchObject({ author: "MicioFan", correct: true, score: 1 });
    scheduler.advanceBy(1_000);
    expect(quiz.state.remainingSeconds).toBe(7);

    scheduler.advanceBy(7_000);
    expect(quiz.state.phase).toBe("question");
    expect(quiz.state.question.id).not.toBe(firstQuestionId);
    scheduler.advanceBy(30_000);
    scheduler.advanceBy(8_000);
    expect(quiz.state.phase).toBe("final");
    expect(quiz.state.overallLeaderboard[0]).toMatchObject({ author: "MicioFan", correctAnswers: 1, percentage: 100 });
    scheduler.advanceBy(1_000);
    expect(quiz.state.remainingSeconds).toBe(14);

    scheduler.advanceBy(14_000);
    expect(quiz.state.phase).toBe("question");
    expect(quiz.state.question.id).toBe(firstQuestionId);
    expect(quiz.state.questionNumber).toBe(1);
  });
});
