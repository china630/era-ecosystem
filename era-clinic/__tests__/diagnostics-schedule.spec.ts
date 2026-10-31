import {
  buildVisitScheduledAt,
  formatDraftSchedule,
  parseDraftSchedule,
} from "@/domain/sanatorium/diagnostics-schedule";

describe("diagnostics-schedule", () => {
  it("formats date-only and date+time without inventing a clock", () => {
    expect(formatDraftSchedule("2026-11-01")).toBe("01.11.2026");
    expect(formatDraftSchedule("2026-11-01T14:30")).toBe("01.11.2026 14:30");
    expect(formatDraftSchedule("2026-11-01T14:30:00")).toBe("01.11.2026 14:30");
  });

  it("builds visit stamps with optional time (no T09:00 invent)", () => {
    expect(buildVisitScheduledAt("2026-11-01", "")).toBe("2026-11-01");
    expect(buildVisitScheduledAt("2026-11-01", "09:00")).toBe("2026-11-01T09:00");
    expect(buildVisitScheduledAt("", "09:00")).toBeUndefined();
    expect(buildVisitScheduledAt("bad", "09:00")).toBeUndefined();
  });

  it("parses draft stamps for editors", () => {
    expect(parseDraftSchedule("2026-11-01")).toEqual({
      date: "2026-11-01",
      time: "",
    });
    expect(parseDraftSchedule("2026-11-01T14:30")).toEqual({
      date: "2026-11-01",
      time: "14:30",
    });
    expect(parseDraftSchedule(null)).toEqual({ date: "", time: "" });
  });
});
