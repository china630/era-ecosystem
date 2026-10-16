import { parseBakuDateTime } from "@/lib/baku-day";
import { scanProcedureSlots, type ScanOrder } from "@/lib/procedure-slot-scan";
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
});
