import { boardOccupancyDisplay } from "@/domain/procedure/board-display-time";

describe("boardOccupancyDisplay", () => {
  it("keeps plan clock in the queue", () => {
    const view = boardOccupancyDisplay({
      status: "SCHEDULED",
      scheduledAt: "2026-11-26T06:00:00.000Z",
      endsAt: "2026-11-26T06:30:00.000Z",
      actualStartsAt: "2026-11-26T11:00:00.000Z",
      actualEndsAt: "2026-11-26T11:30:00.000Z",
    });
    expect(view.kind).toBe("plan");
    expect(view.startIso).toBe("2026-11-26T06:00:00.000Z");
    expect(view.endIso).toBe("2026-11-26T06:30:00.000Z");
  });

  it("shows factual window after check-in", () => {
    const view = boardOccupancyDisplay({
      status: "CHECKED_IN",
      scheduledAt: "2026-11-26T06:00:00.000Z",
      endsAt: "2026-11-26T06:30:00.000Z",
      actualStartsAt: "2026-11-26T11:00:00.000Z",
      actualEndsAt: "2026-11-26T11:30:00.000Z",
      resourceId: "cabin-1",
      hasResource: true,
    });
    expect(view.kind).toBe("actual");
    expect(view.startIso).toBe("2026-11-26T11:00:00.000Z");
    expect(view.endIso).toBe("2026-11-26T11:30:00.000Z");
  });

  it("marks OPEN unseated queue rows", () => {
    const view = boardOccupancyDisplay({
      status: "SCHEDULED",
      schedulingMode: "OPEN",
      scheduledAt: "2026-11-26T04:00:00.000Z",
    });
    expect(view.kind).toBe("open");
    expect(view.openUnseated).toBe(true);
  });
});
