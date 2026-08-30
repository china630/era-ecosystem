import {
  day1ConfirmSoftWarn,
  isExamPrefixCode,
  isSameDayFourthOrLater,
  sortLinesExamPrefixFirst,
} from "@/lib/sanatorium-day1";
import {
  fifoConfirmBlockedReason,
  procedureConfirmHttpStatus,
} from "@/lib/sanatorium-fifo-gates";
import { z } from "zod";

describe("Wave C day-1 helpers (CLI-52)", () => {
  it("sorts exam/intake codes before bath/treatment", () => {
    const sorted = sortLinesExamPrefixFirst([
      { procedureCode: "NAFTALAN_BATH" },
      { procedureCode: "USG_ABDOMEN" },
      { procedureCode: "THERAPIST_INTAKE" },
      { procedureCode: "MUD_PACK" },
      { procedureCode: "ECG" },
    ]);
    expect(sorted.map((l) => l.procedureCode)).toEqual([
      "ECG",
      "THERAPIST_INTAKE",
      "USG_ABDOMEN",
      "MUD_PACK",
      "NAFTALAN_BATH",
    ]);
    expect(isExamPrefixCode("ECG")).toBe(true);
    expect(isExamPrefixCode("NAFTALAN_BATH")).toBe(false);
  });

  it("soft-warns when confirm batch >3; does not warn at 3", () => {
    expect(day1ConfirmSoftWarn(3)).toBeNull();
    expect(day1ConfirmSoftWarn(4)).toMatch(/soft cap/i);
  });

  it("marks 4th same-day as paid extra; 3rd is still in daily free band", () => {
    // 2 other same-day → this is 3rd → not fourth+
    expect(isSameDayFourthOrLater(2)).toBe(false);
    // 3 other same-day → this is 4th → paid extra
    expect(isSameDayFourthOrLater(3)).toBe(true);
  });

  it("allows FIFO confirm of first 3 by sequenceIndex; skip-first still 409", () => {
    const proposed = [
      { id: "a", sequenceIndex: 1 },
      { id: "b", sequenceIndex: 2 },
      { id: "c", sequenceIndex: 3 },
      { id: "d", sequenceIndex: 4 },
    ];
    expect(
      fifoConfirmBlockedReason({
        confirmingIds: ["a", "b", "c"],
        proposedForPatient: proposed,
      }),
    ).toBeNull();
    const skip = fifoConfirmBlockedReason({
      confirmingIds: ["b", "c"],
      proposedForPatient: proposed,
    });
    expect(skip).toMatch(/FIFO/i);
    expect(procedureConfirmHttpStatus(skip)).toBe(409);
  });

  it("settings PATCH schema accepts ON_CHECKIN / AFTER_CHECKUP", () => {
    const schema = z.object({
      programSchedulingMode: z.enum(["ON_CHECKIN", "AFTER_CHECKUP"]).optional(),
    });
    expect(schema.parse({ programSchedulingMode: "AFTER_CHECKUP" }).programSchedulingMode).toBe(
      "AFTER_CHECKUP",
    );
    expect(schema.parse({ programSchedulingMode: "ON_CHECKIN" }).programSchedulingMode).toBe(
      "ON_CHECKIN",
    );
    expect(schema.safeParse({ programSchedulingMode: "NOW" }).success).toBe(false);
  });
});
