export type QuizOption = 1 | 2 | 3 | 4;
export type QuizPhase = "question" | "results" | "final";
export type QuizDifficulty = "facile" | "medio" | "difficile";

export interface PublicQuizState {
  phase: QuizPhase;
  questionNumber: number;
  totalQuestions: number;
  remainingSeconds: number;
  question: { id: string; prompt: string; options: readonly [string, string, string, string]; difficulty: QuizDifficulty };
  responses: readonly { option: QuizOption; count: number; percentage: number }[];
  result?: { correctOption: QuizOption; responses: readonly { option: QuizOption; count: number; percentage: number }[] };
  leaderboard: readonly { author: string; avatarUrl?: string; correctAnswers: number; answeredQuestions: number; percentage: number }[];
}

export type QuizStateFetcher = (url: string, init: RequestInit) => Promise<Response>;

function isState(value: unknown): value is PublicQuizState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<PublicQuizState>;
  const validResponse = (response: unknown): boolean => !!response && typeof response === "object"
    && [1, 2, 3, 4].includes((response as { option?: unknown }).option as number)
    && Number.isFinite((response as { count?: unknown }).count)
    && Number.isFinite((response as { percentage?: unknown }).percentage);
  const validRanking = (player: unknown): boolean => !!player && typeof player === "object"
    && typeof (player as { author?: unknown }).author === "string"
    && ((player as { avatarUrl?: unknown }).avatarUrl === undefined || typeof (player as { avatarUrl?: unknown }).avatarUrl === "string")
    && Number.isFinite((player as { correctAnswers?: unknown }).correctAnswers)
    && Number.isFinite((player as { answeredQuestions?: unknown }).answeredQuestions)
    && Number.isFinite((player as { percentage?: unknown }).percentage);
  const validQuestion = !!state.question && typeof state.question.id === "string" && state.question.id.trim().length > 0
    && typeof state.question.prompt === "string" && state.question.prompt.trim().length > 0
    && Array.isArray(state.question.options) && state.question.options.length === 4
    && state.question.options.every((option) => typeof option === "string" && option.trim().length > 0)
    && (state.question.difficulty === "facile" || state.question.difficulty === "medio" || state.question.difficulty === "difficile");
  const validResult = state.result !== undefined && [1, 2, 3, 4].includes(state.result.correctOption)
    && Array.isArray(state.result.responses) && state.result.responses.every(validResponse);
  return (state.phase === "question" || state.phase === "results" || state.phase === "final")
    && Number.isFinite(state.questionNumber) && Number.isFinite(state.totalQuestions) && Number.isFinite(state.remainingSeconds)
    && validQuestion && Array.isArray(state.responses) && state.responses.length === 4 && state.responses.every(validResponse)
    && Array.isArray(state.leaderboard) && state.leaderboard.every(validRanking)
    && (state.phase === "question" ? state.result === undefined : validResult);
}

export function resolveQuizStateUrl(relayUrl: string, configuredUrl?: string): string {
  if (configuredUrl?.trim()) return configuredUrl.trim();
  const url = new URL(relayUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = "/quiz/state";
  url.search = "";
  url.hash = "";
  return url.toString();
}

/** Applies an abortable deadline so a stalled relay cannot trap OBS in loading state. */
export async function loadQuizState(url: string, signal: AbortSignal, fetcher: QuizStateFetcher = (requestUrl, init) => fetch(requestUrl, init)): Promise<PublicQuizState> {
  const response = await fetcher(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Quiz state request failed with HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (!isState(payload)) throw new Error("Quiz API returned invalid public state");
  return payload;
}
