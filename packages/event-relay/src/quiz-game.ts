import type { ChatEvent } from "@miciodev/shared-types";
import type { PythonQuestion, QuizDifficulty, QuizOption } from "./quiz/question-bank.js";

export type QuizPhase = "question" | "results" | "final";

export interface QuizScheduler {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}

export interface PublicQuizQuestion {
  id: string;
  prompt: string;
  options: readonly [string, string, string, string];
  difficulty: QuizDifficulty;
}

export interface PublicQuizResponse {
  option: QuizOption;
  count: number;
  percentage: number;
}

export interface PublicQuizResult {
  correctOption: QuizOption;
  responses: readonly PublicQuizResponse[];
}

export interface PublicQuizRanking {
  author: string;
  avatarUrl?: string;
  correctAnswers: number;
  answeredQuestions: number;
  percentage: number;
}

export interface PublicQuizState {
  phase: QuizPhase;
  questionNumber: number;
  totalQuestions: number;
  remainingSeconds: number;
  question: PublicQuizQuestion;
  responses: readonly PublicQuizResponse[];
  result?: PublicQuizResult;
  leaderboard: readonly PublicQuizRanking[];
}

export interface QuizGameOptions {
  questions: readonly PythonQuestion[];
  scheduler?: QuizScheduler;
  random?: () => number;
  questionDurationMs?: number;
  resultsDurationMs?: number;
  finalDurationMs?: number;
  maxParticipants?: number;
  questionCount?: number;
  onRoundStart?: () => void;
}

interface PlayerScore {
  author: string;
  avatarUrl?: string;
  answers: number;
  correct: number;
}

const defaultScheduler: QuizScheduler = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle),
};

function isQuizOption(value: string): value is `${QuizOption}` {
  return value === "1" || value === "2" || value === "3" || value === "4";
}

function responses(answers: ReadonlyMap<string, QuizOption>): readonly PublicQuizResponse[] {
  return ([1, 2, 3, 4] as const).map((option) => {
    const count = [...answers.values()].filter((answer) => answer === option).length;
    return { option, count, percentage: answers.size === 0 ? 0 : Math.round((count / answers.size) * 100) };
  });
}

function selectQuestions(questions: readonly PythonQuestion[], count: number, random: () => number): PythonQuestion[] {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled.slice(0, count);
}

/** The relay's single authoritative quiz loop; clients only receive public round state. */
export class QuizGame {
  private readonly scheduler: QuizScheduler;
  private readonly random: () => number;
  private readonly questionDurationMs: number;
  private readonly resultsDurationMs: number;
  private readonly finalDurationMs: number;
  private readonly maxParticipants: number;
  private readonly questionCount: number;
  private selectedQuestions: PythonQuestion[] = [];
  private questionIndex = 0;
  private phase: QuizPhase = "question";
  private deadlineMs = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private answers = new Map<string, QuizOption>();
  private scores = new Map<string, PlayerScore>();

  public constructor(private readonly options: QuizGameOptions) {
    if (options.questions.length < 10) throw new Error("QuizGame requires at least ten questions");
    this.scheduler = options.scheduler ?? defaultScheduler;
    this.random = options.random ?? Math.random;
    this.questionDurationMs = options.questionDurationMs ?? 30_000;
    this.resultsDurationMs = options.resultsDurationMs ?? 8_000;
    this.finalDurationMs = options.finalDurationMs ?? 15_000;
    this.maxParticipants = options.maxParticipants ?? 500;
    this.questionCount = options.questionCount ?? 10;
    if (this.questionCount < 1 || this.questionCount > options.questions.length || this.maxParticipants < 1) throw new Error("Invalid quiz configuration");
  }

  public start(): void { this.startGame(); }

  public stop(): void { if (this.timer) this.scheduler.clearTimeout(this.timer); this.timer = undefined; }

  public submit(event: ChatEvent): boolean {
    if (this.phase !== "question" || this.scheduler.now() >= this.deadlineMs) return false;
    const rawAnswer = event.message.trim();
    if (!isQuizOption(rawAnswer)) return false;
    const participantId = event.authorId?.trim();
    if (!participantId || this.answers.has(participantId)) return false;
    const score = this.scores.get(participantId);
    if (!score && this.scores.size >= this.maxParticipants) return false;
    const answer = Number(rawAnswer) as QuizOption;
    this.answers.set(participantId, answer);
    const nextScore = score ?? { author: event.author.trim() || "Spettatore", avatarUrl: undefined, answers: 0, correct: 0 };
    nextScore.answers += 1;
    // Keep the earliest known avatar rather than dropping it on a later message that omits one.
    nextScore.avatarUrl = event.avatarUrl ?? nextScore.avatarUrl;
    if (answer === this.currentQuestion.correctOption) nextScore.correct += 1;
    this.scores.set(participantId, nextScore);
    return true;
  }

  public get state(): PublicQuizState {
    const current = this.currentQuestion;
    const currentResponses = responses(this.answers);
    const leaderboard = [...this.scores.values()]
      .map((score) => ({ author: score.author, avatarUrl: score.avatarUrl, correctAnswers: score.correct, answeredQuestions: score.answers, percentage: Math.round((score.correct / score.answers) * 100) }))
      .sort((left, right) => right.correctAnswers - left.correctAnswers || right.answeredQuestions - left.answeredQuestions || left.author.localeCompare(right.author));
    return {
      phase: this.phase,
      questionNumber: this.questionIndex + 1,
      totalQuestions: this.questionCount,
      remainingSeconds: Math.max(0, Math.ceil((this.deadlineMs - this.scheduler.now()) / 1_000)),
      question: { id: current.id, prompt: current.prompt, options: current.options, difficulty: current.difficulty },
      responses: currentResponses,
      result: this.phase === "question" ? undefined : { correctOption: current.correctOption, responses: currentResponses },
      leaderboard: this.phase === "question" ? [] : leaderboard,
    };
  }

  private get currentQuestion(): PythonQuestion { return this.selectedQuestions[this.questionIndex] ?? this.options.questions[0]; }

  private startGame(): void {
    this.stop();
    this.selectedQuestions = selectQuestions(this.options.questions, this.questionCount, this.random);
    this.options.onRoundStart?.();
    this.questionIndex = 0;
    this.scores = new Map();
    this.startQuestion();
  }

  private startQuestion(): void {
    this.phase = "question";
    this.answers = new Map();
    this.deadlineMs = this.scheduler.now() + this.questionDurationMs;
    this.schedule(this.questionDurationMs, () => this.showResults());
  }

  private showResults(): void {
    this.phase = "results";
    this.deadlineMs = this.scheduler.now() + this.resultsDurationMs;
    this.schedule(this.resultsDurationMs, () => {
      if (this.questionIndex + 1 >= this.selectedQuestions.length) this.showFinal();
      else { this.questionIndex += 1; this.startQuestion(); }
    });
  }

  private showFinal(): void {
    this.phase = "final";
    this.deadlineMs = this.scheduler.now() + this.finalDurationMs;
    this.schedule(this.finalDurationMs, () => this.startGame());
  }

  private schedule(delayMs: number, callback: () => void): void {
    this.stop();
    this.timer = this.scheduler.setTimeout(callback, delayMs);
  }
}
