import { describe, expect, it, vi } from "vitest";
import type { OverlayEvent } from "@miciodev/shared-types";
import { createAlertSoundPlayer } from "./alert-sound";

const subscriberEvent: OverlayEvent = {
  id: "subscriber-1",
  type: "subscriber",
  occurredAt: "2026-08-22T00:00:00.000Z",
  author: "MicioDev"
};

interface FakeAudioContext {
  readonly currentTime: number;
  readonly state: AudioContextState;
  readonly destination: AudioDestinationNode;
  resume: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  resolveResume: () => void;
}

function createFakeContext(): FakeAudioContext {
  let resolveResume: () => void = () => {};
  const oscillator = {
    type: "sine",
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn()
    },
    connect: vi.fn().mockReturnThis(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn()
  };
  const gain = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn()
    },
    connect: vi.fn().mockReturnThis()
  };

  return {
    currentTime: 0,
    state: "suspended",
    destination: {} as AudioDestinationNode,
    resume: vi.fn(() => new Promise<void>((resolve) => { resolveResume = resolve; })),
    close: vi.fn(async () => undefined),
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
    resolveResume: () => resolveResume()
  };
}

describe("createAlertSoundPlayer", () => {
  it("resumes a suspended audio context before starting the alert tone", async () => {
    const context = createFakeContext();
    const player = createAlertSoundPlayer(() => context as unknown as AudioContext);

    const playback = player.play(subscriberEvent);

    expect(context.resume).toHaveBeenCalledOnce();
    expect(context.createOscillator).not.toHaveBeenCalled();

    context.resolveResume();
    await playback;

    expect(context.createOscillator).toHaveBeenCalledOnce();
    expect(context.createOscillator.mock.results[0]?.value.start).toHaveBeenCalledOnce();
  });
});
