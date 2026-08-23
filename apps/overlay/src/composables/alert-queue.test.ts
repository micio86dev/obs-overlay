import { describe, expect, it } from "vitest";
import { BoundedAlertQueue, orderAlerts } from "./alert-queue";

describe("orderAlerts", () => {
  it("prioritizes membership gifts over low-priority milestones", () => {
    const events = [
      { id: "milestone", type: "member-milestone", occurredAt: "2026-08-23T12:00:00.000Z", author: "Viewer 1", memberMonths: 2 },
      { id: "gift", type: "membership-gift", occurredAt: "2026-08-23T12:00:01.000Z", author: "Viewer 2", membershipCount: 5 },
    ] as const;
    expect(orderAlerts(events).map((event) => event.id)).toEqual(["gift", "milestone"]);
  });
});

describe("BoundedAlertQueue", () => {
  it("keeps high-priority alerts under a burst and aggregates recipients even when separated", () => {
    const queue = new BoundedAlertQueue(3, 10_000);
    queue.enqueue({ id: "recipient-1", type: "membership-gift-received", occurredAt: "2026-08-23T12:00:00.000Z", author: "Viewer 1", recipientCount: 1 }, 0);
    queue.enqueue({ id: "poll", type: "poll", occurredAt: "2026-08-23T12:00:01.000Z", author: "Viewer 2", pollStatus: "active", question: "Ship?", choices: [{ text: "Yes" }] }, 1);
    queue.enqueue({ id: "recipient-2", type: "membership-gift-received", occurredAt: "2026-08-23T12:00:02.000Z", author: "Viewer 3", recipientCount: 2 }, 2);
    queue.enqueue({ id: "gift", type: "membership-gift", occurredAt: "2026-08-23T12:00:03.000Z", author: "Viewer 4", membershipCount: 5 }, 3);
    expect(queue.items.map((event) => event.id)).toEqual(["gift", "recipient-1", "poll"]);
    expect(queue.items.find((event) => event.type === "membership-gift-received")).toMatchObject({ recipientCount: 3 });
  });

  it("expires stale low-priority alerts before displaying them", () => {
    const queue = new BoundedAlertQueue(4, 100);
    queue.enqueue({ id: "poll", type: "poll", occurredAt: "2026-08-23T12:00:00.000Z", author: "Viewer 1", pollStatus: "active", question: "Ship?", choices: [{ text: "Yes" }] }, 0);
    expect(queue.take(101)).toBeUndefined();
  });
});
