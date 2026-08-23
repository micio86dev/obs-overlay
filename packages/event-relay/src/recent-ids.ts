/** Bounded insertion-ordered set: YouTube re-sends messages after a reconnect. */
export class RecentIds {
  private readonly ids = new Set<string>();

  public constructor(private readonly maxEntries = 5_000) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error("maxEntries must be a positive integer");
  }

  public has(id: string): boolean {
    return this.ids.has(id);
  }

  public add(id: string): void {
    this.ids.add(id);
    if (this.ids.size <= this.maxEntries) return;
    const oldest = this.ids.values().next().value;
    if (typeof oldest === "string") this.ids.delete(oldest);
  }
}
