import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pythonQuestionBank, type PythonQuestion, type QuizDifficulty, type QuizOption } from "./quiz/question-bank.js";

export interface QuizQuestionRepository {
  listQuestions(): readonly PythonQuestion[];
  close(): void;
}

export interface QuizQuestionRepositoryOptions {
  databasePath?: string;
  environment?: NodeJS.ProcessEnv;
}

interface QuizQuestionRow {
  id: string;
  prompt: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  correctOption: number;
  difficulty: string;
}

const createQuestionTable = `
  CREATE TABLE IF NOT EXISTS quiz_questions (
    id TEXT PRIMARY KEY,
    prompt TEXT NOT NULL,
    option_1 TEXT NOT NULL,
    option_2 TEXT NOT NULL,
    option_3 TEXT NOT NULL,
    option_4 TEXT NOT NULL,
    correct_option INTEGER NOT NULL CHECK(correct_option BETWEEN 1 AND 4),
    difficulty TEXT NOT NULL CHECK(difficulty IN ('facile', 'medio', 'difficile'))
  )
`;

/** Uses a writable local path by default while Railway receives its mounted-volume path explicitly. */
export function resolveQuizDatabasePath(value = process.env.QUIZ_DATABASE_PATH): string {
  return value?.trim() || resolve(process.cwd(), "data", "quiz.sqlite");
}

/** Rejects an ephemeral production database unless the operator explicitly opts into it. */
export function ensureQuizDatabaseDirectory(databasePath: string, environment = process.env): void {
  if (databasePath === ":memory:") return;
  const parent = dirname(databasePath);
  const requireVolume = environment.QUIZ_REQUIRE_VOLUME === "true";
  const allowEphemeral = environment.QUIZ_ALLOW_EPHEMERAL_DATABASE === "true";
  if (requireVolume && !allowEphemeral) {
    if (environment.RAILWAY_VOLUME_MOUNT_PATH !== parent || !existsSync(parent) || !statSync(parent).isDirectory()) {
      throw new Error(`QUIZ_DATABASE_PATH parent must be the mounted Railway volume at ${parent}; set QUIZ_ALLOW_EPHEMERAL_DATABASE=true only for an explicit non-durable override`);
    }
    return;
  }
  mkdirSync(parent, { recursive: true });
}

/**
 * Creates the question table and atomically restores the versioned one-hundred-question bank.
 * Drops the table first (rather than CREATE IF NOT EXISTS) so a schema change — e.g. adding the
 * difficulty column — takes effect against an existing Railway volume too; every row here is
 * bundled, disposable data, never anything a viewer or streamer wrote.
 */
export function seedQuizDatabase(database: DatabaseSync): void {
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec("DROP TABLE IF EXISTS quiz_questions");
    database.exec(createQuestionTable);
    const insertQuestion = database.prepare(`
      INSERT INTO quiz_questions (id, prompt, option_1, option_2, option_3, option_4, correct_option, difficulty)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const question of pythonQuestionBank) {
      insertQuestion.run(
        question.id,
        question.prompt,
        question.options[0],
        question.options[1],
        question.options[2],
        question.options[3],
        question.correctOption,
        question.difficulty,
      );
    }
    database.exec("COMMIT");
  } catch (error: unknown) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/** Opens the relay-owned SQLite question store and seeds it before accepting requests. */
export function openQuizQuestionRepository(options: QuizQuestionRepositoryOptions = {}): QuizQuestionRepository {
  const databasePath = options.databasePath ?? resolveQuizDatabasePath();
  ensureQuizDatabaseDirectory(databasePath, options.environment);

  const database = new DatabaseSync(databasePath);
  seedQuizDatabase(database);
  const selectQuestions = database.prepare(`
    SELECT
      id,
      prompt,
      option_1 AS option1,
      option_2 AS option2,
      option_3 AS option3,
      option_4 AS option4,
      correct_option AS correctOption,
      difficulty
    FROM quiz_questions
    ORDER BY CAST(SUBSTR(id, 8) AS INTEGER)
  `);

  return {
    listQuestions: (): readonly PythonQuestion[] => (selectQuestions.all() as unknown as QuizQuestionRow[]).map((row) => ({
      id: row.id,
      prompt: row.prompt,
      options: [row.option1, row.option2, row.option3, row.option4],
      correctOption: row.correctOption as QuizOption,
      difficulty: row.difficulty as QuizDifficulty,
    })),
    close: (): void => database.close(),
  };
}
