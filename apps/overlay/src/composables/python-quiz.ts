import type { ChatEvent } from "@miciodev/shared-types";

export type QuizOption = 1 | 2 | 3 | 4;

export interface PythonQuestion {
  id: string;
  prompt: string;
  options: readonly [string, string, string, string];
  correctOption: QuizOption;
}

export type QuizPhase = "question" | "results" | "final";

export interface QuizScheduler {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(handle: number): void;
}

export interface QuizResponseSummary {
  option: QuizOption;
  count: number;
  percentage: number;
}

export interface QuizQuestionRanking {
  playerId: string;
  author: string;
  answer: QuizOption;
  correct: boolean;
  score: number;
}

export interface QuizOverallRanking {
  playerId: string;
  author: string;
  correctAnswers: number;
  answeredQuestions: number;
  percentage: number;
}

export interface PythonQuizState {
  phase: QuizPhase;
  question: PythonQuestion;
  questionNumber: number;
  totalQuestions: number;
  remainingSeconds: number;
  responses: readonly QuizResponseSummary[];
  questionLeaderboard: readonly QuizQuestionRanking[];
  overallLeaderboard: readonly QuizOverallRanking[];
}

export interface PythonQuizOptions {
  questions: readonly PythonQuestion[];
  scheduler?: QuizScheduler;
  random?: () => number;
  onStateChange?: (state: PythonQuizState) => void;
  questionCount?: number;
  questionDurationMs?: number;
  resultsDurationMs?: number;
  finalDurationMs?: number;
}

export interface PythonQuizConfig {
  questionCount: number;
  questionDurationMs: number;
  resultsDurationMs: number;
  finalDurationMs: number;
}

export const defaultPythonQuizConfig: Readonly<PythonQuizConfig> = {
  questionCount: 10,
  questionDurationMs: 30_000,
  resultsDurationMs: 8_000,
  finalDurationMs: 15_000,
};

/** Keeps replay timing intentional and prevents invalid timer loops. */
export function validatePythonQuizConfig(config: PythonQuizConfig, availableQuestionCount: number): PythonQuizConfig {
  if (!Number.isInteger(config.questionCount) || config.questionCount < 1 || config.questionCount > availableQuestionCount) {
    throw new Error(`questionCount must be an integer between 1 and ${availableQuestionCount}`);
  }
  for (const [name, duration] of Object.entries({
    questionDurationMs: config.questionDurationMs,
    resultsDurationMs: config.resultsDurationMs,
    finalDurationMs: config.finalDurationMs,
  })) {
    if (!Number.isInteger(duration) || duration < 1_000) throw new Error(`${name} must be a positive integer of at least 1000ms`);
  }
  return { ...config };
}

/** Bounded insertion-ordered de-duplication for an indefinitely running OBS overlay. */
export class BoundedEventIdSet {
  private readonly ids = new Set<string>();

  public constructor(private readonly maxSize: number) {
    if (!Number.isInteger(maxSize) || maxSize < 1) throw new Error("maxSize must be a positive integer");
  }

  public add(id: string): boolean {
    if (this.ids.has(id)) return false;
    this.ids.add(id);
    if (this.ids.size > this.maxSize) {
      const oldest = this.ids.values().next().value;
      if (typeof oldest === "string") this.ids.delete(oldest);
    }
    return true;
  }

  public get size(): number { return this.ids.size; }
}

interface PlayerAnswer {
  playerId: string;
  answer: QuizOption;
  author: string;
}

interface PlayerScore {
  playerId: string;
  author: string;
  answers: number;
  correct: number;
}

const defaultScheduler: QuizScheduler = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimeout: (handle) => window.clearTimeout(handle),
};

function isQuizOption(value: string): value is `${QuizOption}` {
  return value === "1" || value === "2" || value === "3" || value === "4";
}

function toQuizOption(value: string): QuizOption {
  return Number(value) as QuizOption;
}

function selectQuestions(questions: readonly PythonQuestion[], count: number, random: () => number): PythonQuestion[] {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, count);
}

export class PythonQuiz {
  private readonly scheduler: QuizScheduler;
  private readonly random: () => number;
  private readonly onStateChange: (state: PythonQuizState) => void;
  private readonly questionCount: number;
  private readonly questionDurationMs: number;
  private readonly resultsDurationMs: number;
  private readonly finalDurationMs: number;
  private readonly questions: readonly PythonQuestion[];
  private selectedQuestions: PythonQuestion[] = [];
  private questionIndex = 0;
  private phase: QuizPhase = "question";
  private deadlineMs = 0;
  private timer: number | undefined;
  private answers = new Map<string, PlayerAnswer>();
  private scores = new Map<string, PlayerScore>();
  private readonly stateListeners = new Set<(state: PythonQuizState) => void>();
  private active = false;
  public state: PythonQuizState;

  public constructor(options: PythonQuizOptions) {
    if (options.questions.length < 1) throw new Error("PythonQuiz requires at least one question");
    this.questions = options.questions;
    const config = validatePythonQuizConfig({
      questionCount: options.questionCount ?? defaultPythonQuizConfig.questionCount,
      questionDurationMs: options.questionDurationMs ?? defaultPythonQuizConfig.questionDurationMs,
      resultsDurationMs: options.resultsDurationMs ?? defaultPythonQuizConfig.resultsDurationMs,
      finalDurationMs: options.finalDurationMs ?? defaultPythonQuizConfig.finalDurationMs,
    }, options.questions.length);
    this.questionCount = config.questionCount;
    this.scheduler = options.scheduler ?? defaultScheduler;
    this.random = options.random ?? Math.random;
    this.onStateChange = options.onStateChange ?? (() => undefined);
    this.questionDurationMs = config.questionDurationMs;
    this.resultsDurationMs = config.resultsDurationMs;
    this.finalDurationMs = config.finalDurationMs;
    this.state = this.createState();
  }

  public start(): void {
    this.stopTimer();
    this.active = true;
    this.startGame();
  }

  public stop(): void {
    this.active = false;
    this.stopTimer();
  }

  public subscribe(listener: (state: PythonQuizState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  public submit(event: ChatEvent): boolean {
    if (!this.active || this.phase !== "question" || this.scheduler.now() >= this.deadlineMs) return false;
    const message = event.message.trim();
    if (!isQuizOption(message)) return false;
    const playerId = event.authorId?.trim() || event.author.trim();
    if (!playerId || this.answers.has(playerId)) return false;
    const answer = toQuizOption(message);
    this.answers.set(playerId, { playerId, author: event.author.trim() || "Viewer", answer });
    const score = this.scores.get(playerId) ?? { playerId, author: event.author.trim() || "Viewer", answers: 0, correct: 0 };
    score.answers += 1;
    if (answer === this.currentQuestion.correctOption) score.correct += 1;
    this.scores.set(playerId, score);
    this.emitState();
    return true;
  }

  private startGame(): void {
    this.selectedQuestions = selectQuestions(this.questions, this.questionCount, this.random);
    this.questionIndex = 0;
    this.scores = new Map();
    this.startQuestion();
  }

  private startQuestion(): void {
    this.phase = "question";
    this.answers = new Map();
    this.deadlineMs = this.scheduler.now() + this.questionDurationMs;
    this.emitState();
    this.scheduleTick();
  }

  private showResults(): void {
    if (!this.active) return;
    this.phase = "results";
    this.deadlineMs = this.scheduler.now() + this.resultsDurationMs;
    this.emitState();
    this.schedulePhaseCountdown(this.resultsDurationMs, () => {
      if (this.questionIndex + 1 >= this.selectedQuestions.length) this.showFinal();
      else {
        this.questionIndex += 1;
        this.startQuestion();
      }
    });
  }

  private showFinal(): void {
    if (!this.active) return;
    this.phase = "final";
    this.deadlineMs = this.scheduler.now() + this.finalDurationMs;
    this.emitState();
    this.schedulePhaseCountdown(this.finalDurationMs, () => this.startGame());
  }

  private scheduleTick(): void {
    this.stopTimer();
    const tick = (): void => {
      if (!this.active || this.phase !== "question") return;
      const remainingMs = this.deadlineMs - this.scheduler.now();
      if (remainingMs <= 0) {
        this.showResults();
        return;
      }
      this.emitState();
      this.timer = this.scheduler.setTimeout(tick, Math.min(1_000, remainingMs));
    };
    this.timer = this.scheduler.setTimeout(tick, Math.min(1_000, this.questionDurationMs));
  }

  private schedulePhaseCountdown(durationMs: number, onComplete: () => void): void {
    const tick = (): void => {
      if (!this.active) return;
      const remainingMs = this.deadlineMs - this.scheduler.now();
      if (remainingMs <= 0) {
        onComplete();
        return;
      }
      this.emitState();
      this.timer = this.scheduler.setTimeout(tick, Math.min(1_000, remainingMs));
    };
    this.timer = this.scheduler.setTimeout(tick, Math.min(1_000, durationMs));
  }

  private stopTimer(): void {
    if (this.timer !== undefined) this.scheduler.clearTimeout(this.timer);
    this.timer = undefined;
  }

  private get currentQuestion(): PythonQuestion {
    return this.selectedQuestions[this.questionIndex] ?? this.questions[0];
  }

  private createState(): PythonQuizState {
    const responses = ([1, 2, 3, 4] as const).map((option) => {
      const count = [...this.answers.values()].filter((answer) => answer.answer === option).length;
      const total = this.answers.size;
      return { option, count, percentage: total === 0 ? 0 : Math.round((count / total) * 100) };
    });
    const questionLeaderboard = [...this.answers.values()]
      .map((answer) => ({ playerId: answer.playerId, author: answer.author, answer: answer.answer, correct: answer.answer === this.currentQuestion.correctOption, score: this.scores.get(answer.playerId)?.correct ?? 0 }))
      .sort((left, right) => Number(right.correct) - Number(left.correct) || right.score - left.score || left.author.localeCompare(right.author));
    const overallLeaderboard = [...this.scores.values()]
      .map((score) => ({ playerId: score.playerId, author: score.author, correctAnswers: score.correct, answeredQuestions: score.answers, percentage: Math.round((score.correct / score.answers) * 100) }))
      .sort((left, right) => right.correctAnswers - left.correctAnswers || right.answeredQuestions - left.answeredQuestions || left.author.localeCompare(right.author));
    return {
      phase: this.phase,
      question: this.currentQuestion,
      questionNumber: this.questionIndex + 1,
      totalQuestions: this.questionCount,
      remainingSeconds: Math.max(0, Math.ceil((this.deadlineMs - this.scheduler.now()) / 1_000)),
      responses,
      questionLeaderboard,
      overallLeaderboard,
    };
  }

  private emitState(): void {
    this.state = this.createState();
    this.onStateChange(this.state);
    this.stateListeners.forEach((listener) => listener(this.state));
  }

}
