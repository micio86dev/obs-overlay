import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { createQuizRequestHandler } from "../src/quiz-api.js";
import { QuizGame } from "../src/quiz-game.js";
import { ensureQuizDatabaseDirectory, openQuizQuestionRepository, seedQuizDatabase } from "../src/quiz-repository.js";

function temporaryDatabasePath(): { directory: string; databasePath: string } {
  const directory = mkdtempSync(join(tmpdir(), "miciodev-quiz-"));
  return { directory, databasePath: join(directory, "quiz.sqlite") };
}

test("seeds exactly one hundred Python questions idempotently", () => {
  const { directory, databasePath } = temporaryDatabasePath();
  const database = new DatabaseSync(databasePath);

  try {
    seedQuizDatabase(database);
    seedQuizDatabase(database);
    database.exec("INSERT INTO quiz_questions (id, prompt, option_1, option_2, option_3, option_4, correct_option, difficulty) VALUES ('obsolete', 'obsolete', '1', '2', '3', '4', 1, 'facile')");
    seedQuizDatabase(database);

    const row = database.prepare("SELECT COUNT(*) AS count FROM quiz_questions").get() as { count: number };
    assert.equal(row.count, 100);

    const firstQuestion = database.prepare("SELECT id, correct_option AS correctOption FROM quiz_questions WHERE id = 'python-1'").get() as { id: string; correctOption: number };
    assert.equal(firstQuestion.id, "python-1");
    assert.equal(firstQuestion.correctOption, 2);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("fails closed in production when the database parent is not the mounted Railway volume", () => {
  assert.throws(
    () => ensureQuizDatabaseDirectory("/app/data/quiz.sqlite", { QUIZ_REQUIRE_VOLUME: "true", RAILWAY_VOLUME_MOUNT_PATH: "/other" }),
    /mounted Railway volume/,
  );
});

test("serves read-only CORS-enabled quiz questions for the static overlay", async () => {
  const { directory, databasePath } = temporaryDatabasePath();
  const repository = openQuizQuestionRepository({ databasePath });
  const game = new QuizGame({ questions: repository.listQuestions(), random: () => 0 });
  game.start();
  const server = createServer((request, response) => {
    if (!createQuizRequestHandler(game)(request, response)) {
      response.writeHead(404);
      response.end();
    }
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");

    const response = await fetch(`http://127.0.0.1:${address.port}/quiz/state`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    const payload: unknown = await response.json();
    assert.ok(payload && typeof payload === "object" && "question" in payload);
    const question = (payload as { question: unknown }).question;
    assert.ok(question && typeof question === "object" && "id" in question && "options" in question);
    assert.equal(JSON.stringify(payload).includes("correctOption"), false);

    const writeAttempt = await fetch(`http://127.0.0.1:${address.port}/quiz/state`, { method: "POST" });
    assert.equal(writeAttempt.status, 405);
    assert.equal(writeAttempt.headers.get("allow"), "GET, OPTIONS");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    game.stop();
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
