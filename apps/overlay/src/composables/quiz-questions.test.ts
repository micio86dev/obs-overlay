import { describe, expect, it, vi } from "vitest";
import { loadQuizQuestions, resolveQuizQuestionsUrl } from "./quiz-questions";

const validQuestions = Array.from({ length: 10 }, (_, index) => ({
  id: `python-${index + 1}`,
  prompt: `Question ${index + 1}`,
  options: ["one", "two", "three", "four"],
  correctOption: 2,
}));

describe("quiz question API client", () => {
  it("derives the HTTP quiz endpoint from the existing relay WebSocket URL", () => {
    expect(resolveQuizQuestionsUrl("wss://relay.example/events")).toBe("https://relay.example/quiz/questions");
    expect(resolveQuizQuestionsUrl("ws://localhost:8787/events", "https://quiz.example/questions")).toBe("https://quiz.example/questions");
  });

  it("loads only a valid question bank large enough for an autonomous round", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ questions: validQuestions }), { status: 200 }));

    await expect(loadQuizQuestions("https://relay.example/quiz/questions", fetcher)).resolves.toEqual(validQuestions);
    expect(fetcher).toHaveBeenCalledWith("https://relay.example/quiz/questions", { cache: "no-store" });
  });

  it("fails safely rather than starting a quiz from malformed API data", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ questions: [{ ...validQuestions[0], options: ["one"] }] }), { status: 200 }));

    await expect(loadQuizQuestions("https://relay.example/quiz/questions", fetcher)).rejects.toThrow("valid quiz questions");
  });
});
