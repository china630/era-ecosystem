import { createHash } from "crypto";
import {
  WorkforceAttendanceDirection,
  WorkforceAttendancePunchStatus,
  WorkforceAttendanceReviewStatus,
  WorkforceTimesheetEntryStatus,
  WorkforceTimesheetStatus,
} from "@era365/database";
import { WorkforceAttendanceService } from "./workforce-attendance.service";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLACE_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const EMP_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const DEVICE_A = "11111111-1111-4111-8111-111111111111";
const ACTOR = "33333333-3333-4333-8333-333333333333";
const TS = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function sha256Hex(v: string) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

describe("WorkforceAttendanceService wave 10 minutes", () => {
  const prisma: any = {
    workforceAttendanceDevice: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    workforceAttendanceIdentity: { findUnique: jest.fn() },
    workforceAttendancePunch: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    workforceAttendancePunchJournal: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    workforcePlace: { findFirst: jest.fn() },
    workforceEmployment: { findFirst: jest.fn() },
    workforceShiftAssignment: { findFirst: jest.fn() },
    workforceBrigadeMember: { findFirst: jest.fn() },
    workforceDayOverride: { findFirst: jest.fn() },
    workforceShiftType: { findMany: jest.fn(), findFirst: jest.fn() },
    workforceTimesheet: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    workforceTimesheetEntry: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) =>
      fn(prisma),
    ),
  };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const audit = { log: jest.fn() };
  const employments = { resolvePersonProfiles: jest.fn() };
  const catalog = {
    getCalendarDaysRange: jest.fn().mockResolvedValue({ days: [] }),
  };
  const fitness = { listFloorIssues: jest.fn().mockResolvedValue([]) };
  const svc = new WorkforceAttendanceService(
    prisma,
    entitlement as never,
    audit as never,
    employments as never,
    catalog as never,
    fitness as never,
  );

  const rawToken = "att_test_token_wave10_abc";
  const tokenHash = sha256Hex(rawToken);

  beforeEach(() => {
    jest.clearAllMocks();
    entitlement.assertWorkforceHub.mockResolvedValue(undefined);
    audit.log.mockResolvedValue(undefined);
    employments.resolvePersonProfiles.mockResolvedValue({});
    catalog.getCalendarDaysRange.mockResolvedValue({ days: [] });
    prisma.workforceAttendanceDevice.findFirst.mockResolvedValue({
      id: DEVICE_A,
      organizationId: ORG_A,
      placeId: PLACE_A,
      tokenHash,
      hmacSecretHash: null,
      status: "ACTIVE",
    });
    prisma.workforceAttendanceDevice.update.mockResolvedValue({});
    prisma.workforceAttendanceIdentity.findUnique.mockResolvedValue({
      employmentId: EMP_A,
      personRef: "badge-1",
      organizationId: ORG_A,
    });
    prisma.workforceEmployment.findFirst.mockResolvedValue({
      id: EMP_A,
      organizationId: ORG_A,
    });
    prisma.workforceAttendancePunch.findUnique.mockResolvedValue(null);
    prisma.workforceAttendancePunch.findFirst.mockResolvedValue(null);
    prisma.workforceAttendancePunch.create.mockImplementation(
      async ({ data }: any) => ({
        id: "punch-" + (data.externalId ?? data.direction),
        ...data,
      }),
    );
    prisma.workforceAttendancePunchJournal.findMany.mockResolvedValue([]);
    prisma.workforcePlace.findFirst.mockResolvedValue({
      id: PLACE_A,
      organizationId: ORG_A,
      latitude: null,
      longitude: null,
      radiusMeters: null,
      allowOutside: false,
      graceMinutes: 0,
    });
    prisma.workforceShiftAssignment.findFirst.mockResolvedValue({
      placeId: PLACE_A,
      cycle: {
        cycleAnchor: new Date("2026-09-15T00:00:00.000Z"),
        slots: [
          {
            slotIndex: 0,
            shiftTypeId: "day",
            shiftType: {
              startMinute: 9 * 60,
              endMinute: 18 * 60,
              breakMinutes: 60,
              defaultHours: 8,
            },
          },
        ],
      },
    });
    prisma.workforceBrigadeMember.findFirst.mockResolvedValue(null);
    prisma.workforceDayOverride.findFirst.mockResolvedValue(null);
    prisma.workforceShiftType.findFirst.mockResolvedValue(null);
    prisma.workforceTimesheet.findUnique.mockResolvedValue({
      id: TS,
      organizationId: ORG_A,
      year: 2026,
      month: 9,
      status: WorkforceTimesheetStatus.DRAFT,
    });
    prisma.workforceTimesheetEntry.findUnique.mockResolvedValue(null);
    prisma.workforceTimesheetEntry.upsert.mockResolvedValue({});
    prisma.workforceAttendancePunch.update.mockResolvedValue({});
  });

  it("break minutes subtracted; hours is normal only", async () => {
    const inAt = new Date("2026-09-16T05:00:00.000Z"); // 09:00 Baku
    const brS = new Date("2026-09-16T08:00:00.000Z"); // 12:00
    const brE = new Date("2026-09-16T09:00:00.000Z"); // 13:00
    const outAt = new Date("2026-09-16T14:00:00.000Z"); // 18:00
    prisma.workforceAttendancePunch.findMany.mockResolvedValue([
      {
        id: "p-in",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.IN,
        occurredAt: inAt,
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
        reviewStatus: WorkforceAttendanceReviewStatus.CLEAR,
      },
      {
        id: "p-bs",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.BREAK_START,
        occurredAt: brS,
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
        reviewStatus: WorkforceAttendanceReviewStatus.CLEAR,
      },
      {
        id: "p-be",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.BREAK_END,
        occurredAt: brE,
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
        reviewStatus: WorkforceAttendanceReviewStatus.CLEAR,
      },
      {
        id: "p-out",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.OUT,
        occurredAt: outAt,
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
        reviewStatus: WorkforceAttendanceReviewStatus.CLEAR,
      },
    ]);

    const summary = await svc.rebuild(ORG_A, ACTOR, "2026-09-16", "2026-09-16");
    expect(summary.cellsUpserted).toBe(1);
    const upsert = prisma.workforceTimesheetEntry.upsert.mock.calls[0][0];
    expect(Number(upsert.create.hours)).toBe(8);
    expect(upsert.create.breakMinutes).toBe(60);
    expect(upsert.create.normalMinutes).toBe(480);
    expect(upsert.create.overtimeMinutes).toBe(0);
  });

  it("open BREAK_START does not write a cell by itself", async () => {
    prisma.workforceAttendancePunch.findMany.mockResolvedValue([
      {
        id: "p-bs",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.BREAK_START,
        occurredAt: new Date("2026-09-16T08:00:00.000Z"),
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
        reviewStatus: WorkforceAttendanceReviewStatus.CLEAR,
      },
    ]);
    const summary = await svc.rebuild(ORG_A, ACTOR, "2026-09-16", "2026-09-16");
    expect(summary.cellsUpserted).toBe(0);
    expect(prisma.workforceTimesheetEntry.upsert).not.toHaveBeenCalled();
    expect(summary.openLeft).toBe(1);
  });

  it("post-shift minutes go to overtimeMinutes not hours", async () => {
    const inAt = new Date("2026-09-16T05:00:00.000Z"); // 09:00
    const outAt = new Date("2026-09-16T16:00:00.000Z"); // 20:00
    prisma.workforceAttendancePunch.findMany.mockResolvedValue([
      {
        id: "p-in",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.IN,
        occurredAt: inAt,
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
        reviewStatus: WorkforceAttendanceReviewStatus.CLEAR,
      },
      {
        id: "p-out",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.OUT,
        occurredAt: outAt,
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
        reviewStatus: WorkforceAttendanceReviewStatus.CLEAR,
      },
    ]);
    await svc.rebuild(ORG_A, ACTOR, "2026-09-16", "2026-09-16");
    const upsert = prisma.workforceTimesheetEntry.upsert.mock.calls[0][0];
    expect(upsert.create.overtimeMinutes).toBe(120);
    expect(Number(upsert.create.hours)).toBe(9);
    expect(upsert.create.normalMinutes).toBe(540);
  });

  it("night band 22:00–06:00 fills nightMinutes", async () => {
    prisma.workforceShiftAssignment.findFirst.mockResolvedValue({
      placeId: PLACE_A,
      cycle: {
        cycleAnchor: new Date("2026-09-15T00:00:00.000Z"),
        slots: [
          {
            slotIndex: 0,
            shiftTypeId: "night",
            shiftType: {
              startMinute: 20 * 60,
              endMinute: 8 * 60,
              breakMinutes: 0,
              defaultHours: 12,
            },
          },
        ],
      },
    });
    prisma.workforceAttendancePunch.findMany.mockResolvedValue([
      {
        id: "p-in",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.IN,
        occurredAt: new Date("2026-09-16T16:00:00.000Z"), // 20:00 Baku
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
        reviewStatus: WorkforceAttendanceReviewStatus.CLEAR,
      },
      {
        id: "p-out",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.OUT,
        occurredAt: new Date("2026-09-17T04:00:00.000Z"), // 08:00 Baku
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
        reviewStatus: WorkforceAttendanceReviewStatus.CLEAR,
      },
    ]);
    await svc.rebuild(ORG_A, ACTOR, "2026-09-16", "2026-09-17");
    const upsert = prisma.workforceTimesheetEntry.upsert.mock.calls[0][0];
    expect(upsert.create.nightMinutes).toBe(8 * 60);
    expect(Number(upsert.create.hours)).toBe(12);
    expect(upsert.create.overtimeMinutes).toBe(0);
  });

  it("holiday calendar day does not fill restDayMinutes", async () => {
    catalog.getCalendarDaysRange.mockResolvedValue({
      days: [{ date: "2026-09-16", dayType: "holiday", isWorking: false }],
    });
    prisma.workforceAttendancePunch.findMany.mockResolvedValue([
      {
        id: "p-in",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.IN,
        occurredAt: new Date("2026-09-16T05:00:00.000Z"),
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
        reviewStatus: WorkforceAttendanceReviewStatus.CLEAR,
      },
      {
        id: "p-out",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.OUT,
        occurredAt: new Date("2026-09-16T13:00:00.000Z"),
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
        reviewStatus: WorkforceAttendanceReviewStatus.CLEAR,
      },
    ]);
    await svc.rebuild(ORG_A, ACTOR, "2026-09-16", "2026-09-16");
    const upsert = prisma.workforceTimesheetEntry.upsert.mock.calls[0][0];
    expect(upsert.create.holidayMinutes).toBe(480);
    expect(upsert.create.restDayMinutes).toBe(0);
    expect(Number(upsert.create.hours)).toBe(0);
  });

  it("does not overwrite APPROVED cell", async () => {
    prisma.workforceAttendancePunch.findMany.mockResolvedValue([
      {
        id: "p-in",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.IN,
        occurredAt: new Date("2026-09-16T05:00:00.000Z"),
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
        reviewStatus: WorkforceAttendanceReviewStatus.CLEAR,
      },
      {
        id: "p-out",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.OUT,
        occurredAt: new Date("2026-09-16T13:00:00.000Z"),
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
        reviewStatus: WorkforceAttendanceReviewStatus.CLEAR,
      },
    ]);
    prisma.workforceTimesheetEntry.findUnique.mockResolvedValue({
      id: "cell-1",
      status: WorkforceTimesheetEntryStatus.APPROVED,
      lockedFromAbsence: false,
    });
    const summary = await svc.rebuild(ORG_A, ACTOR, "2026-09-16", "2026-09-16");
    expect(prisma.workforceTimesheetEntry.upsert).not.toHaveBeenCalled();
    expect(summary.cellsSkippedApproved).toBe(1);
  });
});
