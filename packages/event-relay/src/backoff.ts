/** Exponential retry delay with a ceiling, so a failing dependency never busy-loops. */
export class Backoff {
  private attempt = 0;

  public constructor(
    private readonly baseMs: number,
    private readonly maximumMs: number,
    private readonly maximumAttempts = 5,
  ) {
    if (baseMs <= 0 || maximumMs < baseMs) throw new Error("Invalid backoff bounds");
  }

  public next(): number {
    const delay = Math.min(this.baseMs * 2 ** this.attempt, this.maximumMs);
    this.attempt = Math.min(this.attempt + 1, this.maximumAttempts);
    return delay;
  }

  public reset(): void {
    this.attempt = 0;
  }
}
