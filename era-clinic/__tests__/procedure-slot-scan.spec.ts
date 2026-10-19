import { parseBakuDateTime } from "@/lib/baku-day";
import {
  evaluateCandidateSlot,
  placementBlockReason,
  scanProcedureSlots,
  type ScanOrder,
} from "@/lib/procedure-slot-scan";
import type { TenantWorkHours } from "@/domain/settings/scheduling-settings";

const hours: TenantWorkHours = {
  dayStartHour: 8,
  dayEndHour: 17,
  lunchStartHour: 13,
  lunchEndHour: 14,
  closedWeekdays: [0],
  peakModeEnabled: false,
  peakDayEndHour: 17,
};

function order(): ScanOrder {
  return {
    id: "order-1",
    organizationId: "org",
    procedureCode: "SVC-PARA",
    procedureName: "Parafin",
    bodyPart: null,
    inPackage: true,
    durationMin: 30,
    dayEndHour: 17,
    patientRestMinutes: 15,
    resourceGapMinutes: 5,
    afterLunchAllowed: true,
    beforeLunchAllowed: true,
    typeHours: hours,
    physicalRole: "LOCATION",
    resources: [{ id: "cabin-1", capacity: 1, role: "LOCATION" }],
    staffMode: "HARD",
    procedureTypeId: "type-1",
  };
}

describe("scanProcedureSlots", () => {
  const now = parseBakuDateTime("2026-10-16", "09:00");

  it("seats the first free slot without scanning the database", () => {
    const result = scanProcedureSlots({
      orders: [order()],
      now,
      slotMinutes: 5,
      packageCap: 8,
      horizonEndYmd: "2026-10-18",
      closedYmds: new Set(),
      staffByTypeAndYmd: new Map([["type-1|2026-10-16", [{ id: "nurse-1", fullName: "A", code: "N1" }]]]),
      rules: [],
      rotationRules: [],
      compatibilityRules: [],
      patientSlots: [],
      rotationContext: [],
      allocations: [],
    });
    expect(result.failures).toEqual([]);
    expect(result.planned).toHaveLength(1);
    expect(result.planned[0]?.staffId).toBe("nurse-1");
    expect(result.planned[0]?.resourceId).toBe("cabin-1");
  });

  it("reports no staff when nobody is on duty", () => {
    const result = scanProcedureSlots({
      orders: [order()],
      now,
      slotMinutes: 5,
      packageCap: 8,
      horizonEndYmd: "2026-10-18",
      closedYmds: new Set(),
      staffByTypeAndYmd: new Map(),
      rules: [],
      rotationRules: [],
      compatibilityRules: [],
      patientSlots: [],
      rotationContext: [],
      allocations: [],
    });
    expect(result.planned).toEqual([]);
    expect(result.failures[0]?.reason).toBe("no_staff");
    expect(result.failures[0]?.procedureName).toBe("Parafin");
  });

  it("reports no open day when the stay has already ended", () => {
    const result = scanProcedureSlots({
      orders: [order()],
      now,
      slotMinutes: 5,
      packageCap: 8,
      horizonEndYmd: "2026-10-16",
      closedYmds: new Set(),
      staffByTypeAndYmd: new Map(),
      rules: [],
      rotationRules: [],
      compatibilityRules: [],
      patientSlots: [],
      rotationContext: [],
      allocations: [],
    });
    expect(result.failures[0]?.reason).toBe("no_slot");
  });

  it("starts on the next 5-minute mark, not the raw minute", () => {
    const result = scanProcedureSlots({
      orders: [order()],
      now: parseBakuDateTime("2026-10-16", "09:36"),
      slotMinutes: 5,
      packageCap: 8,
      horizonEndYmd: "2026-10-18",
      closedYmds: new Set(),
      staffByTypeAndYmd: new Map([["type-1|2026-10-16", [{ id: "nurse-1", fullName: "A", code: "N1" }]]]),
      rules: [],
      rotationRules: [],
      compatibilityRules: [],
      patientSlots: [],
      rotationContext: [],
      allocations: [],
    });
    expect(result.planned[0]?.slotStart.getTime()).toBe(
      parseBakuDateTime("2026-10-16", "09:40").getTime(),
    );
  });

  it("refuses a same-minute start even when rest after is zero", () => {
    const second = { ...order(), id: "order-2", procedureCode: "SVC-BATH", procedureName: "Naftalan" };
    const result = scanProcedureSlots({
      orders: [second],
      now,
      slotMinutes: 5,
      packageCap: 8,
      horizonEndYmd: "2026-10-18",
      closedYmds: new Set(),
      staffByTypeAndYmd: new Map([["type-1|2026-10-16", [{ id: "nurse-1", fullName: "A", code: "N1" }]]]),
      rules: [],
      rotationRules: [],
      compatibilityRules: [],
      patientSlots: [
        {
          code: "SVC-PARA",
          start: parseBakuDateTime("2026-10-16", "09:00"),
          end: parseBakuDateTime("2026-10-16", "09:20"),
          patientRestMinutes: 0,
          inPackage: true,
          countsForRest: true,
        },
      ],
      rotationContext: [],
      allocations: [],
    });
    expect(result.planned[0]?.slotStart.getTime()).toBe(
      parseBakuDateTime("2026-10-16", "09:20").getTime(),
    );
  });

  it("keeps a pinned order on that day behind an existing guest slot", () => {
    const bath = {
      ...order(),
      id: "bath-1",
      procedureCode: "SVC-NAFTALAN",
      procedureName: "Naftalan",
      pinYmd: "2026-10-16",
      patientRestMinutes: 40,
    };
    const result = scanProcedureSlots({
      orders: [bath],
      now,
      slotMinutes: 5,
      packageCap: 8,
      horizonEndYmd: "2026-10-18",
      closedYmds: new Set(),
      staffByTypeAndYmd: new Map([["type-1|2026-10-16", [{ id: "nurse-1", fullName: "A", code: "N1" }]]]),
      rules: [],
      rotationRules: [],
      compatibilityRules: [],
      patientSlots: [
        {
          code: "SVC-PARA",
          start: parseBakuDateTime("2026-10-16", "09:00"),
          end: parseBakuDateTime("2026-10-16", "09:20"),
          patientRestMinutes: 15,
          inPackage: true,
          countsForRest: true,
        },
      ],
      rotationContext: [],
      allocations: [],
    });
    expect(result.failures).toEqual([]);
    expect(result.planned[0]?.slotStart.getTime()).toBe(
      parseBakuDateTime("2026-10-16", "09:35").getTime(),
    );
  });

  it("skips a closed Sunday and seats the next open day", () => {
    const result = scanProcedureSlots({
      orders: [order()],
      now: parseBakuDateTime("2026-10-18", "09:00"),
      slotMinutes: 5,
      packageCap: 8,
      horizonEndYmd: "2026-10-21",
      closedYmds: new Set(["2026-10-18"]),
      staffByTypeAndYmd: new Map([
        ["type-1|2026-10-18", [{ id: "nurse-1", fullName: "A", code: "N1" }]],
        ["type-1|2026-10-19", [{ id: "nurse-1", fullName: "A", code: "N1" }]],
      ]),
      rules: [],
      rotationRules: [],
      compatibilityRules: [],
      patientSlots: [],
      rotationContext: [],
      allocations: [],
    });
    expect(result.failures).toEqual([]);
    expect(result.planned[0]?.slotStart.getTime()).toBe(
      parseBakuDateTime("2026-10-19", "08:00").getTime(),
    );
  });
});

describe("evaluateCandidateSlot", () => {
  const slot = {
    order: order(),
    slotStart: parseBakuDateTime("2026-10-16", "10:00"),
    slotEnd: parseBakuDateTime("2026-10-16", "10:30"),
    packageCap: 3,
    closedYmds: new Set<string>(),
    staffByTypeAndYmd: new Map([["type-1|2026-10-16", [{ id: "nurse-1", fullName: "A", code: "N1" }]]]),
    rules: [],
    rotationRules: [],
    compatibilityRules: [],
    patientSlots: [],
    rotationContext: [],
    allocations: [],
  };

  it("accepts a free open-day minute", () => {
    const verdict = evaluateCandidateSlot(slot);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.staff.id).toBe("nurse-1");
  });

  it("refuses a closed day without snapping", () => {
    const verdict = evaluateCandidateSlot({
      ...slot,
      slotStart: parseBakuDateTime("2026-10-18", "10:00"),
      slotEnd: parseBakuDateTime("2026-10-18", "10:30"),
      closedYmds: new Set(["2026-10-18"]),
      staffByTypeAndYmd: new Map([["type-1|2026-10-18", [{ id: "nurse-1", fullName: "A", code: "N1" }]]]),
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe("closed");
  });

  it("refuses a fourth distinct package SKU", () => {
    const verdict = evaluateCandidateSlot({
      ...slot,
      patientSlots: [
        { code: "A", start: slot.slotStart, end: slot.slotEnd, patientRestMinutes: 0, inPackage: true, countsForRest: false },
        { code: "B", start: slot.slotStart, end: slot.slotEnd, patientRestMinutes: 0, inPackage: true, countsForRest: false },
        { code: "C", start: slot.slotStart, end: slot.slotEnd, patientRestMinutes: 0, inPackage: true, countsForRest: false },
      ],
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe("day_full");
  });

  it("does not apply the package cap to a paid extra", () => {
    const verdict = evaluateCandidateSlot({
      ...slot,
      order: { ...order(), inPackage: false },
      patientSlots: [
        { code: "A", start: slot.slotStart, end: slot.slotEnd, patientRestMinutes: 0, inPackage: true, countsForRest: false },
        { code: "B", start: slot.slotStart, end: slot.slotEnd, patientRestMinutes: 0, inPackage: true, countsForRest: false },
        { code: "C", start: slot.slotStart, end: slot.slotEnd, patientRestMinutes: 0, inPackage: true, countsForRest: false },
      ],
    });
    expect(verdict.ok).toBe(true);
  });

  it("reports day_full, not no_staff, when the package day is already full", () => {
    const bath = {
      ...order(),
      id: "bath-cap",
      procedureCode: "SVC-NAFTALAN",
      procedureName: "Naftalan",
      pinYmd: "2026-10-16",
    };
    const dayStart = parseBakuDateTime("2026-10-16", "09:00");
    const dayEnd = parseBakuDateTime("2026-10-16", "09:20");
    const result = scanProcedureSlots({
      orders: [bath],
      now: dayStart,
      slotMinutes: 5,
      packageCap: 3,
      horizonEndYmd: "2026-10-18",
      closedYmds: new Set(),
      staffByTypeAndYmd: new Map([["type-1|2026-10-16", [{ id: "nurse-1", fullName: "A", code: "N1" }]]]),
      rules: [],
      rotationRules: [],
      compatibilityRules: [],
      patientSlots: [
        { code: "A", start: dayStart, end: dayEnd, patientRestMinutes: 0, inPackage: true, countsForRest: false },
        { code: "B", start: dayStart, end: dayEnd, patientRestMinutes: 0, inPackage: true, countsForRest: false },
        { code: "C", start: dayStart, end: dayEnd, patientRestMinutes: 0, inPackage: true, countsForRest: false },
      ],
      rotationContext: [],
      allocations: [],
    });
    expect(result.planned).toEqual([]);
    expect(result.failures[0]?.reason).toBe("day_full");
  });

  it("reports no staff when the duty line is empty", () => {
    const verdict = evaluateCandidateSlot({
      ...slot,
      staffByTypeAndYmd: new Map(),
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe("no_staff");
  });
});

describe("placementBlockReason", () => {
  const empty = { day_full: 0, staff_busy: 0, cabin_busy: 0, rule: 0 };

  it("prefers day_full when the package cap rejected every slot", () => {
    expect(placementBlockReason(true, false, { ...empty, day_full: 12 })).toBe("day_full");
  });

  it("still reports no_staff when the duty pool was empty", () => {
    expect(placementBlockReason(true, false, empty)).toBe("no_staff");
  });
});
