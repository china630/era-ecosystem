import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  WorkforceDayOverrideKind,
  WorkforceTimesheetEntryStatus,
  WorkforceTimesheetEntryType,
  WorkforceTimesheetStatus,
} from "@era365/database";
import { WorkforceRosterService } from "./workforce-roster.service";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TS = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const EMP = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PLACE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CYCLE = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const ASG = "11111111-1111-4111-8111-111111111111";
const TYPE_OFFICE = "22222222-2222-4222-8222-222222222222";
const ACTOR = "33333333-3333-4333-8333-333333333333";

describe("WorkforceRosterService.materializeMonth", () => {
  const prisma: any = {
    workforceTimesheet: { findFirst: jest.fn() },
    workforceEmployment: { findMany: jest.fn(), count: jest.fn() },
    workforceShiftAssignment: { findMany: jest.fn() },
    workforceBrigadeMember: { findMany: jest.fn() },
    workforceShiftCycle: { findMany: jest.fn() },
    workforceDayOverride: { findMany: jest.fn(), upsert: jest.fn() },
    workforceShiftType: { findMany: jest.fn(), count: jest.fn() },
    workforceTimesheetEntry: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    workforcePlace: { findFirst: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const audit = { log: jest.fn() };
  const svc = new WorkforceRosterService(
    prisma,
    entitlement as never,
    audit as never,
  );

  const sheet = {
    id: TS,
    organizationId: ORG_A,
    year: 2026,
    month: 1,
    status: WorkforceTimesheetStatus.DRAFT,
  };

  const cycle = {
    id: CYCLE,
    organizationId: ORG_A,
    code: "FIVE_TWO",
    cycleAnchor: new Date("2026-01-05T00:00:00.000Z"),
    slots: [
      {
        slotIndex: 0,
        shiftTypeId: TYPE_OFFICE,
        shiftType: { id: TYPE_OFFICE, defaultHours: 8 },
      },
      {
        slotIndex: 1,
        shiftTypeId: TYPE_OFFICE,
        shiftType: { id: TYPE_OFFICE, defaultHours: 8 },
      },
      {
        slotIndex: 2,
        shiftTypeId: TYPE_OFFICE,
        shiftType: { id: TYPE_OFFICE, defaultHours: 8 },
      },
      {
        slotIndex: 3,
        shiftTypeId: TYPE_OFFICE,
        shiftType: { id: TYPE_OFFICE, defaultHours: 8 },
      },
      {
        slotIndex: 4,
        shiftTypeId: TYPE_OFFICE,
        shiftType: { id: TYPE_OFFICE, defaultHours: 8 },
      },
      { slotIndex: 5, shiftTypeId: null, shiftType: null },
      { slotIndex: 6, shiftTypeId: null, shiftType: null },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    entitlement.assertWorkforceHub.mockResolvedValue(undefined);
    audit.log.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
    );
    prisma.workforceTimesheet.findFirst.mockResolvedValue(sheet);
    prisma.workforceEmployment.findMany.mockResolvedValue([{ id: EMP }]);
    prisma.workforceShiftAssignment.findMany.mockResolvedValue([
      {
        id: ASG,
        organizationId: ORG_A,
        placeId: PLACE,
        cycleId: CYCLE,
        employmentId: EMP,
        brigadeId: null,
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        effectiveTo: null,
      },
    ]);
    prisma.workforceBrigadeMember.findMany.mockResolvedValue([]);
    prisma.workforceShiftCycle.findMany.mockResolvedValue([cycle]);
    prisma.workforceDayOverride.findMany.mockResolvedValue([]);
    prisma.workforceShiftType.findMany.mockResolvedValue([
      { id: TYPE_OFFICE, defaultHours: 8 },
    ]);
    prisma.workforcePlace.findMany.mockResolvedValue([
      { id: PLACE, code: "SITE_A", name: "Site A" },
    ]);
    prisma.workforceTimesheetEntry.findMany.mockResolvedValue([]);
    prisma.workforceTimesheetEntry.upsert.mockResolvedValue({});
  });

  it("writes roster_plan cells for DRAFT month", async () => {
    const result = await svc.materializeMonth(ORG_A, TS, ACTOR);
    expect(result.cellsTouched).toBeGreaterThan(0);
    expect(prisma.workforceTimesheetEntry.upsert).toHaveBeenCalled();
    const firstCall = prisma.workforceTimesheetEntry.upsert.mock.calls[0][0];
    expect(firstCall.create.source).toBe("roster_plan");
    expect(firstCall.create.sourceRef).toBe(ASG);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "TIMESHEET_ROSTER_MATERIALIZED" }),
    );
  });

  it("rejects non-DRAFT timesheet with 409", async () => {
    prisma.workforceTimesheet.findFirst.mockResolvedValue({
      ...sheet,
      status: WorkforceTimesheetStatus.APPROVED,
    });
    await expect(svc.materializeMonth(ORG_A, TS, ACTOR)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("does not overwrite APPROVED or lockedFromAbsence cells", async () => {
    prisma.workforceTimesheetEntry.findMany.mockResolvedValue([
      {
        employmentId: EMP,
        workDate: new Date("2026-01-05T00:00:00.000Z"),
        status: WorkforceTimesheetEntryStatus.APPROVED,
        lockedFromAbsence: false,
        source: "ops_grid",
      },
      {
        employmentId: EMP,
        workDate: new Date("2026-01-06T00:00:00.000Z"),
        status: WorkforceTimesheetEntryStatus.DRAFT,
        lockedFromAbsence: true,
        source: "ops_grid",
        type: WorkforceTimesheetEntryType.VACATION,
      },
    ]);
    const result = await svc.materializeMonth(ORG_A, TS, ACTOR);
    expect(result.cellsSkippedLocked).toBeGreaterThanOrEqual(2);
    const upsertedDates = prisma.workforceTimesheetEntry.upsert.mock.calls.map(
      (c: [{ where: { timesheetId_employmentId_workDate: { workDate: Date } } }]) =>
        c[0].where.timesheetId_employmentId_workDate.workDate
          .toISOString()
          .slice(0, 10),
    );
    expect(upsertedDates).not.toContain("2026-01-05");
    expect(upsertedDates).not.toContain("2026-01-06");
  });

  it("default does not overwrite occupied cells", async () => {
    prisma.workforceTimesheetEntry.findMany.mockResolvedValue([
      {
        employmentId: EMP,
        workDate: new Date("2026-01-05T00:00:00.000Z"),
        status: WorkforceTimesheetEntryStatus.DRAFT,
        lockedFromAbsence: false,
        source: "ops_grid",
      },
    ]);
    const result = await svc.materializeMonth(ORG_A, TS, ACTOR);
    expect(result.cellsSkippedManual).toBeGreaterThanOrEqual(1);
    const upsertedDates = prisma.workforceTimesheetEntry.upsert.mock.calls.map(
      (c: [{ where: { timesheetId_employmentId_workDate: { workDate: Date } } }]) =>
        c[0].where.timesheetId_employmentId_workDate.workDate
          .toISOString()
          .slice(0, 10),
    );
    expect(upsertedDates).not.toContain("2026-01-05");
  });

  it("overwriteFacts writes over ops_grid and faceid", async () => {
    prisma.workforceTimesheetEntry.findMany.mockResolvedValue([
      {
        employmentId: EMP,
        workDate: new Date("2026-01-05T00:00:00.000Z"),
        status: WorkforceTimesheetEntryStatus.DRAFT,
        lockedFromAbsence: false,
        source: "faceid",
      },
    ]);
    await svc.materializeMonth(ORG_A, TS, ACTOR, { overwriteFacts: true });
    const upsertedDates = prisma.workforceTimesheetEntry.upsert.mock.calls.map(
      (c: [{ where: { timesheetId_employmentId_workDate: { workDate: Date } } }]) =>
        c[0].where.timesheetId_employmentId_workDate.workDate
          .toISOString()
          .slice(0, 10),
    );
    expect(upsertedDates).toContain("2026-01-05");
  });

  it("preserveManual skips ops_grid cells", async () => {
    prisma.workforceTimesheetEntry.findMany.mockResolvedValue([
      {
        employmentId: EMP,
        workDate: new Date("2026-01-05T00:00:00.000Z"),
        status: WorkforceTimesheetEntryStatus.DRAFT,
        lockedFromAbsence: false,
        source: "ops_grid",
      },
    ]);
    const result = await svc.materializeMonth(ORG_A, TS, ACTOR, {
      preserveManual: true,
      overwriteFacts: true,
    });
    expect(result.cellsSkippedManual).toBeGreaterThanOrEqual(1);
    const upsertedDates = prisma.workforceTimesheetEntry.upsert.mock.calls.map(
      (c: [{ where: { timesheetId_employmentId_workDate: { workDate: Date } } }]) =>
        c[0].where.timesheetId_employmentId_workDate.workDate
          .toISOString()
          .slice(0, 10),
    );
    expect(upsertedDates).not.toContain("2026-01-05");
  });

  it("DAY_OFF override beats cycle; absence-locked cell still skipped", async () => {
    prisma.workforceDayOverride.findMany.mockResolvedValue([
      {
        employmentId: EMP,
        workDate: new Date("2026-01-05T00:00:00.000Z"),
        kind: "DAY_OFF",
        placeId: null,
        shiftTypeId: null,
        shiftType: null,
      },
    ]);
    prisma.workforceTimesheetEntry.findMany.mockResolvedValue([
      {
        employmentId: EMP,
        workDate: new Date("2026-01-07T00:00:00.000Z"),
        status: WorkforceTimesheetEntryStatus.DRAFT,
        lockedFromAbsence: true,
        source: "ops_grid",
      },
    ]);
    await svc.materializeMonth(ORG_A, TS, ACTOR);
    const jan5 = prisma.workforceTimesheetEntry.upsert.mock.calls.find(
      (c: [{ where: { timesheetId_employmentId_workDate: { workDate: Date } } }]) =>
        c[0].where.timesheetId_employmentId_workDate.workDate
          .toISOString()
          .slice(0, 10) === "2026-01-05",
    );
    expect(jan5[0].create.type).toBe(WorkforceTimesheetEntryType.OFF);
    const upsertedDates = prisma.workforceTimesheetEntry.upsert.mock.calls.map(
      (c: [{ where: { timesheetId_employmentId_workDate: { workDate: Date } } }]) =>
        c[0].where.timesheetId_employmentId_workDate.workDate
          .toISOString()
          .slice(0, 10),
    );
    expect(upsertedDates).not.toContain("2026-01-07");
  });

  it("org isolation: materialize uses only JWT organizationId sheet", async () => {
    prisma.workforceTimesheet.findFirst.mockResolvedValue(null);
    await expect(
      svc.materializeMonth(ORG_B, TS, ACTOR),
    ).rejects.toThrow(/Timesheet not found/);
    expect(prisma.workforceTimesheet.findFirst).toHaveBeenCalledWith({
      where: { id: TS, organizationId: ORG_B },
    });
  });

  it("assignment effectiveTo truncates plan after end date", async () => {
    prisma.workforceShiftAssignment.findMany.mockResolvedValue([
      {
        id: ASG,
        organizationId: ORG_A,
        placeId: PLACE,
        cycleId: CYCLE,
        employmentId: EMP,
        brigadeId: null,
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        effectiveTo: new Date("2026-01-10T00:00:00.000Z"),
      },
    ]);
    await svc.materializeMonth(ORG_A, TS, ACTOR);
    const upsertedDates = prisma.workforceTimesheetEntry.upsert.mock.calls.map(
      (c: [{ where: { timesheetId_employmentId_workDate: { workDate: Date } } }]) =>
        c[0].where.timesheetId_employmentId_workDate.workDate
          .toISOString()
          .slice(0, 10),
    );
    expect(upsertedDates).toContain("2026-01-10");
    expect(upsertedDates).not.toContain("2026-01-11");
  });

  it("as-of membership: person in A through month-end, D from the 1st of next month", async () => {
    const BRIGADE_A = "44444444-4444-4444-8444-444444444444";
    const BRIGADE_D = "55555555-5555-4555-8555-555555555555";
    const PLACE_D = "66666666-6666-4666-8666-666666666666";
    const ASG_D = "77777777-7777-4777-8777-777777777777";
    prisma.workforceShiftAssignment.findMany.mockResolvedValue([
      {
        id: ASG,
        organizationId: ORG_A,
        placeId: PLACE,
        cycleId: CYCLE,
        employmentId: null,
        brigadeId: BRIGADE_A,
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        effectiveTo: null,
      },
      {
        id: ASG_D,
        organizationId: ORG_A,
        placeId: PLACE_D,
        cycleId: CYCLE,
        employmentId: null,
        brigadeId: BRIGADE_D,
        effectiveFrom: new Date("2026-02-01T00:00:00.000Z"),
        effectiveTo: null,
      },
    ]);
    prisma.workforceBrigadeMember.findMany.mockResolvedValue([
      {
        employmentId: EMP,
        brigadeId: BRIGADE_A,
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        effectiveTo: new Date("2026-01-31T00:00:00.000Z"),
      },
      {
        employmentId: EMP,
        brigadeId: BRIGADE_D,
        effectiveFrom: new Date("2026-02-01T00:00:00.000Z"),
        effectiveTo: null,
      },
    ]);
    prisma.workforcePlace.findMany.mockResolvedValue([
      { id: PLACE, code: "SITE_A", name: "Site A" },
      { id: PLACE_D, code: "SITE_D", name: "Site D" },
    ]);
    const jan = await svc.previewMonth(ORG_A, 2026, 1);
    expect(jan.rows[0].cells.find((c) => c.day === 31)?.placeCode).toBe("SITE_A");
    const feb = await svc.previewMonth(ORG_A, 2026, 2);
    expect(feb.rows[0].cells.find((c) => c.day === 1)?.placeCode).toBe("SITE_D");
    expect(jan.rows[0].cells.find((c) => c.day === 15)?.placeCode).toBe("SITE_A");
  });

  it("previewMonth returns person × day plan without writing timesheet", async () => {
    const preview = await svc.previewMonth(ORG_A, 2026, 1);
    expect(preview.lastDay).toBe(31);
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].cells).toHaveLength(31);
    const jan5 = preview.rows[0].cells.find((c) => c.day === 5);
    expect(jan5?.type).toBe("WORK");
    expect(jan5?.placeCode).toBe("SITE_A");
    expect(prisma.workforceTimesheetEntry.upsert).not.toHaveBeenCalled();
  });

  it("upsertOverride EXTRA without placeId is rejected", async () => {
    prisma.workforceEmployment.count.mockResolvedValue(1);
    await expect(
      svc.upsertOverride(ORG_A, ACTOR, {
        employmentId: EMP,
        workDate: "2026-01-12",
        kind: WorkforceDayOverrideKind.EXTRA,
        shiftTypeId: TYPE_OFFICE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workforceDayOverride.upsert).not.toHaveBeenCalled();
  });

  it("upsertOverride EXTRA with placeId and shiftTypeId persists", async () => {
    prisma.workforceEmployment.count.mockResolvedValue(1);
    prisma.workforceDayOverride.upsert.mockResolvedValue({ id: "ov1" });
    await svc.upsertOverride(ORG_A, ACTOR, {
      employmentId: EMP,
      workDate: "2026-01-12",
      kind: WorkforceDayOverrideKind.EXTRA,
      shiftTypeId: TYPE_OFFICE,
      placeId: PLACE,
    });
    expect(prisma.workforceDayOverride.upsert).toHaveBeenCalled();
  });
});
