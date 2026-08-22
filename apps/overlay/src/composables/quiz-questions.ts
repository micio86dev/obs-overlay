import type { PythonQuestion, QuizOption } from "./python-quiz";

export type QuizQuestionFetcher = (url: string, init: RequestInit) => Promise<Response>;

interface QuizQuestionsPayload {
  questions: unknown;
}

function isQuizOption(value: unknown): value is QuizOption {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function isPythonQuestion(value: unknown): value is PythonQuestion {
  if (!value || typeof value !== "object") return false;
  const question = value as Partial<PythonQuestion>;
  return typeof question.id === "string"
    && question.id.trim().length > 0
    && typeof question.prompt === "string"
    && question.prompt.trim().length > 0
    && Array.isArray(question.options)
    && question.options.length === 4
    && question.options.every((option) => typeof option === "string" && option.trim().length > 0)
    && isQuizOption(question.correctOption);
}

/** Resolves the REST endpoint from the same relay base used for WebSocket events. */
export function resolveQuizQuestionsUrl(relayUrl: string, configuredUrl?: string): string {
  if (configuredUrl?.trim()) return configuredUrl.trim();
  const url = new URL(relayUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = "/quiz/questions";
  url.search = "";
  url.hash = "";
  return url.toString();
}

/** Fetches the relay-owned bank and rejects malformed data before a quiz can start. */
export async function loadQuizQuestions(
  url: string,
  fetcher: QuizQuestionFetcher = (requestUrl, init) => fetch(requestUrl, init),
): Promise<readonly PythonQuestion[]> {
  const response = await fetcher(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Quiz question request failed with HTTP ${response.status}`);
  const payload: unknown = await response.json();
  const questions = payload && typeof payload === "object" ? (payload as QuizQuestionsPayload).questions : undefined;
  if (!Array.isArray(questions)) {
    throw new Error("Quiz API returned no valid quiz questions");
  }

  if (questions.length < 10 || !questions.every(isPythonQuestion)) {
    throw new Error("Quiz API returned no valid quiz questions");
  }
  return questions;
}
