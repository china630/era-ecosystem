/**
 * Unit: ambulatory plannedEndsOn feeds stay seat cap when no ProgramInstance.
 */
import { coalesceScheduleBefore } from "@/domain/sanatorium/episode-schedule-horizon";

describe("episode schedule horizon semantics", () => {
  it("prefers program instance endsOn over plannedEndsOn", () => {
    const instanceEnds = new Date("2026-11-20T09:00:00.000Z");
    const planned = new Date("2026-11-15T09:00:00.000Z");
    expect(coalesceScheduleBefore(instanceEnds, planned)).toBe(instanceEnds);
  });

  it("falls back to plannedEndsOn", () => {
    const planned = new Date("2026-11-15T09:00:00.000Z");
    expect(coalesceScheduleBefore(null, planned)).toBe(planned);
  });

  it("returns null when neither is set", () => {
    expect(coalesceScheduleBefore(undefined, null)).toBeNull();
  });
});
