import { describe, expect, it, vi } from "vitest";
import { loadQuizState } from "./quiz-state";

const validState = { phase: "question", questionNumber: 1, totalQuestions: 10, remainingSeconds: 30, question: { id: "python-1", prompt: "Question", options: ["one", "two", "three", "four"] }, responses: [{ option: 1, count: 0, percentage: 0 }, { option: 2, count: 0, percentage: 0 }, { option: 3, count: 0, percentage: 0 }, { option: 4, count: 0, percentage: 0 }], leaderboard: [] };

describe("public quiz-state loader", () => {
  it("accepts a complete public question state", async () => {
    await expect(loadQuizState("/quiz/state", new AbortController().signal, vi.fn().mockResolvedValue(new Response(JSON.stringify(validState))))).resolves.toMatchObject({ phase: "question" });
  });

  it("rejects malformed strings, options, numeric fields, and answer reveal shape", async () => {
    for (const payload of [
      { ...validState, question: { ...validState.question, id: "" } },
      { ...validState, question: { ...validState.question, options: ["one"] } },
      { ...validState, remainingSeconds: Number.NaN },
      { ...validState, phase: "results" },
      { ...validState, phase: "results", result: { correctOption: 5, responses: validState.responses } },
    ]) {
      await expect(loadQuizState("/quiz/state", new AbortController().signal, vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))))).rejects.toThrow("invalid public state");
    }
  });
});
