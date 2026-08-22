import type { OverlayEvent } from "@miciodev/shared-types";

export interface AlertSoundPlayer {
  dispose(): void;
  play(event: OverlayEvent): Promise<void>;
  unlock(): Promise<void>;
}

export type AudioContextFactory = () => AudioContext;

function createAudioContext(): AudioContext {
  return new AudioContext();
}

export function createAlertSoundPlayer(factory: AudioContextFactory = createAudioContext): AlertSoundPlayer {
  let context: AudioContext | undefined;

  function getContext(): AudioContext {
    context ??= factory();
    return context;
  }

  async function resume(): Promise<AudioContext> {
    const audioContext = getContext();
    if (audioContext.state !== "running") await audioContext.resume();
    return audioContext;
  }

  return {
    async play(event: OverlayEvent): Promise<void> {
      try {
        const audioContext = await resume();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = event.type === "superchat" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(event.type === "superchat" ? 660 : 440, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(event.type === "superchat" ? 990 : 660, audioContext.currentTime + .16);
        gain.gain.setValueAtTime(.0001, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(.12, audioContext.currentTime + .02);
        gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + .38);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + .4);
      } catch {
        // Browser autoplay policies must not block visual alerts.
      }
    },
    dispose(): void {
      const audioContext = context;
      context = undefined;
      if (audioContext && audioContext.state !== "closed") void audioContext.close().catch(() => undefined);
    },
    async unlock(): Promise<void> {
      try {
        await resume();
      } catch {
        // A later user gesture or alert will retry without affecting visuals.
      }
    }
  };
}
