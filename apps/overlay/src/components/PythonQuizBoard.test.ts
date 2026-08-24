// @vitest-environment happy-dom
import { createApp, defineComponent, h, nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { App } from "vue";
import PythonQuizBoard from "./PythonQuizBoard.vue";
import type { PublicQuizState } from "../composables/quiz-state";

const questionState: PublicQuizState = {
  phase: "question", questionNumber: 1, totalQuestions: 10, remainingSeconds: 30,
  question: { id: "python-1", prompt: "Question", options: ["one", "two", "three", "four"], difficulty: "facile" },
  responses: [{ option: 1, count: 0, percentage: 0 }, { option: 2, count: 0, percentage: 0 }, { option: 3, count: 0, percentage: 0 }, { option: 4, count: 0, percentage: 0 }],
  leaderboard: [],
};

let mountedApp: App<Element> | undefined;
afterEach(() => { mountedApp?.unmount(); mountedApp = undefined; document.body.replaceChildren(); vi.useRealTimers(); });

describe("PythonQuizBoard", () => {
  it("renders server state without exposing a correct answer during a question", async () => {
    const host = document.createElement("div"); document.body.append(host);
    mountedApp = createApp(defineComponent({ setup: () => () => h(PythonQuizBoard, { events: [], stateLoader: async () => questionState }) }));
    mountedApp.mount(host);
    await Promise.resolve(); await nextTick();
    expect(host.textContent).toContain("Question");
    expect(host.textContent).not.toContain("Risposta corretta");
  });

  it("shows each player's avatar next to their name on the final ranking", async () => {
    const finalState: PublicQuizState = {
      ...questionState,
      phase: "final",
      leaderboard: [
        { author: "MicioFan", avatarUrl: "https://yt3.example/a.jpg", correctAnswers: 5, answeredQuestions: 5, percentage: 100 },
        { author: "Anon", correctAnswers: 1, answeredQuestions: 3, percentage: 33 },
      ],
    };
    const host = document.createElement("div"); document.body.append(host);
    mountedApp = createApp(defineComponent({ setup: () => () => h(PythonQuizBoard, { events: [], stateLoader: async () => finalState }) }));
    mountedApp.mount(host);
    await Promise.resolve(); await nextTick();

    const avatar = host.querySelector(".final-ranking img") as HTMLImageElement | null;
    expect(avatar?.src).toBe("https://yt3.example/a.jpg");
    expect(avatar?.alt).toBe("");
    expect(host.querySelectorAll(".final-ranking li")[1].querySelector("img")).toBeNull();
  });

  it("shows a retrying fallback after a failed state request", async () => {
    const host = document.createElement("div"); document.body.append(host);
    mountedApp = createApp(defineComponent({ setup: () => () => h(PythonQuizBoard, { events: [], stateLoader: async () => { throw new Error("relay unavailable"); } }) }));
    mountedApp.mount(host);
    await Promise.resolve(); await nextTick();
    expect(host.textContent).toContain("DATI QUIZ NON DISPONIBILI");
    expect(host.textContent).toContain("Nuovo tentativo automatico");
  });

  it("times out, retries after five seconds, and recovers when the relay responds", async () => {
    vi.useFakeTimers();
    const host = document.createElement("div"); document.body.append(host);
    const loader = vi.fn()
      .mockImplementationOnce((signal: AbortSignal) => new Promise<PublicQuizState>((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")))))
      .mockResolvedValueOnce(questionState);
    mountedApp = createApp(defineComponent({ setup: () => () => h(PythonQuizBoard, { events: [], stateLoader: loader }) }));
    mountedApp.mount(host);

    await vi.advanceTimersByTimeAsync(4_000);
    await nextTick();
    expect(host.textContent).toContain("DATI QUIZ NON DISPONIBILI");
    expect(loader).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    await nextTick();
    expect(loader).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("Question");
  });

  it("aborts an in-flight request and cancels its retry lifecycle on unmount", async () => {
    vi.useFakeTimers();
    const host = document.createElement("div"); document.body.append(host);
    const aborted = vi.fn();
    const loader = vi.fn((signal: AbortSignal) => new Promise<PublicQuizState>((_resolve, reject) => signal.addEventListener("abort", () => { aborted(); reject(new DOMException("Cancelled", "AbortError")); })));
    mountedApp = createApp(defineComponent({ setup: () => () => h(PythonQuizBoard, { events: [], stateLoader: loader }) }));
    mountedApp.mount(host);
    await nextTick();
    mountedApp.unmount(); mountedApp = undefined;

    expect(aborted).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("cancels a scheduled retry when unmounted after an immediate failure", async () => {
    vi.useFakeTimers();
    const host = document.createElement("div"); document.body.append(host);
    const loader = vi.fn(async () => { throw new Error("offline"); });
    mountedApp = createApp(defineComponent({ setup: () => () => h(PythonQuizBoard, { events: [], stateLoader: loader }) }));
    mountedApp.mount(host);
    await Promise.resolve(); await nextTick();
    mountedApp.unmount(); mountedApp = undefined;

    await vi.advanceTimersByTimeAsync(5_000);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
