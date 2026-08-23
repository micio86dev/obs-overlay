/**
 * Documented YouTube Data API v3 cost per call, in quota units.
 * The default project allowance is 10,000 units/day, so `liveChatMessages` polling
 * dominates: one poll every 10s costs 5 * 8,640 = 43,200 units/day on its own.
 */
export const quotaUnits = { liveChatMessages: 5, search: 100, channels: 1, videos: 1 } as const;

export type QuotaPressure = "normal" | "degraded" | "exhausted";

const degradeRatio = 0.8;
const dayMs = 24 * 60 * 60 * 1_000;

/** Tracks daily quota spend so a long stream degrades gracefully instead of dying on a 403. */
export class QuotaBudget {
  private used = 0;
  private day: number;

  /** `dailyUnits` of 0 disables the budget entirely. */
  public constructor(private readonly dailyUnits: number, private readonly now: () => number = Date.now) {
    if (!Number.isInteger(dailyUnits) || dailyUnits < 0) throw new Error("dailyUnits must be a non-negative integer");
    this.day = this.currentDay();
  }

  private currentDay(): number { return Math.floor(this.now() / dayMs); }

  /** Quota resets at UTC midnight; a multi-day gap collapses into a single reset. */
  private rollOver(): void {
    const day = this.currentDay();
    if (day === this.day) return;
    this.day = day;
    this.used = 0;
  }

  public get spent(): number { this.rollOver(); return this.used; }

  public get pressure(): QuotaPressure {
    if (this.dailyUnits === 0) return "normal";
    const used = this.spent;
    if (used >= this.dailyUnits) return "exhausted";
    return used >= this.dailyUnits * degradeRatio ? "degraded" : "normal";
  }

  public canSpend(units: number): boolean { return this.dailyUnits === 0 || this.spent + units <= this.dailyUnits; }

  public spend(units: number): void { this.rollOver(); this.used += units; }

  public millisecondsUntilReset(): number { return (this.day + 1) * dayMs - this.now(); }
}
