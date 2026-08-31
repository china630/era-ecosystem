import { BadRequestException, GoneException } from "@nestjs/common";
import {
  WorkforceTimesheetEntryStatus,
  WorkforceTimesheetEntryType,
  WorkforceTimesheetStatus,
} from "@era365/database";
import { WorkforceTimesheetsService } from "./workforce-timesheets.service";

const ORG = "44444444-4444-4444-8444-444444444444";
const TS = "55555555-5555-4555-8555-555555555555";
const EMP = "66666666-6666-4666-8666-666666666666";
const ACTOR = "77777777-7777-4777-8777-777777777777";

describe("WorkforceTimesheetsService month grid", () => {
  const prisma = {
    workforceTimesheet: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    workforceTimesheetEntry: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    workforceEmployment: { findMany: jest.fn(), findFirst: jest.fn() },
    workforceAbsence: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const scope = { resolveScopeForCommercialOrg: jest.fn() };
  const audit = { log: jest.fn() };
  const satelliteEvents = { enqueue: jest.fn() };
  const employments = { resolvePersonProfiles: jest.fn() };

  const svc = new WorkforceTimesheetsService(
    prisma as never,
    entitlement as never,
    scope as never,
    audit as never,
    satelliteEvents as never,
    employments as never,
  );

  const sheet = {
    id: TS,
    organizationId: ORG,
    year: 2026,
    month: 8,
    status: WorkforceTimesheetStatus.DRAFT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    entitlement.assertWorkforceHub.mockResolvedValue(undefined);
    employments.resolvePersonProfiles.mockResolvedValue({});
    prisma.workforceEmployment.findMany.mockResolvedValue([
      { id: EMP, globalPersonId: "p1", orgUnit: null, position: null },
    ]);
    prisma.workforceTimesheetEntry.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    });
    scope.resolveScopeForCommercialOrg.mockResolvedValue({
      workforceScopeId: "scope1",
      workforceScope: { id: "scope1", anchorOrganizationId: ORG },
    });
    satelliteEvents.enqueue.mockResolvedValue({ jobId: "j1" });
    audit.log.mockResolvedValue(undefined);
  });

  it("getOrCreateMonth creates a DRAFT header and returns persons", async () => {
    prisma.workforceTimesheet.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue(sheet);
    prisma.workforceTimesheet.create.mockResolvedValue(sheet);
    const out = await svc.getOrCreateMonth(ORG, 2026, 8);
    expect(prisma.workforceTimesheet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG,
          year: 2026,
          month: 8,
          status: WorkforceTimesheetStatus.DRAFT,
        }),
      }),
    );
    expect(out.timesheet.id).toBe(TS);
    expect(employments.resolvePersonProfiles).toHaveBeenCalled();
  });

  it("ensureSheet recovers from unique race P2002", async () => {
    prisma.workforceTimesheet.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(sheet)
      .mockResolvedValue(sheet);
    prisma.workforceTimesheet.create.mockRejectedValue({ code: "P2002" });
    const out = await svc.getOrCreateMonth(ORG, 2026, 8);
    expect(out.timesheet.id).toBe(TS);
  });

  it("autofill writes OFF on Saturday and WORK on Monday", async () => {
    prisma.workforceTimesheet.findFirst.mockResolvedValue(sheet);
    prisma.workforceTimesheetEntry.findMany.mockResolvedValue([]);
    prisma.workforceTimesheetEntry.upsert.mockResolvedValue({});
    await svc.autofill(ORG, TS);
    const typesByDay = new Map<number, string>();
    for (const call of prisma.workforceTimesheetEntry.upsert.mock.calls) {
      const workDate = call[0].create.workDate as Date;
      typesByDay.set(workDate.getUTCDate(), call[0].create.type);
    }
    expect(typesByDay.get(1)).toBe(WorkforceTimesheetEntryType.OFF);
    expect(typesByDay.get(3)).toBe(WorkforceTimesheetEntryType.WORK);
  });

  it("batchUpdate skips lockedFromAbsence and APPROVED cells", async () => {
    prisma.workforceTimesheet.findFirst.mockResolvedValue(sheet);
    prisma.workforceEmployment.findFirst.mockResolvedValue({ id: EMP });
    prisma.workforceTimesheetEntry.findMany.mockResolvedValue([
      {
        employmentId: EMP,
        workDate: new Date("2026-08-01T00:00:00.000Z"),
        lockedFromAbsence: true,
        status: WorkforceTimesheetEntryStatus.DRAFT,
      },
      {
        employmentId: EMP,
        workDate: new Date("2026-08-02T00:00:00.000Z"),
        lockedFromAbsence: false,
        status: WorkforceTimesheetEntryStatus.APPROVED,
      },
    ]);
    await svc.batchUpdate(ORG, TS, [
      {
        employmentId: EMP,
        fromDay: 1,
        toDay: 2,
        type: WorkforceTimesheetEntryType.SICK,
      },
    ]);
    expect(prisma.workforceTimesheetEntry.upsert).not.toHaveBeenCalled();
  });

  it("syncAbsences unlocks orphan locks then locks APPROVED absences", async () => {
    prisma.workforceTimesheet.findFirst.mockResolvedValue(sheet);
    prisma.workforceAbsence.findMany.mockResolvedValue([
      {
        employmentId: EMP,
        kind: "SICK",
        startDate: new Date("2026-08-10T00:00:00.000Z"),
        endDate: new Date("2026-08-10T00:00:00.000Z"),
      },
    ]);
    prisma.workforceTimesheetEntry.findMany
      .mockResolvedValueOnce([
        {
          id: "orphan",
          employmentId: EMP,
          workDate: new Date("2026-08-05T00:00:00.000Z"),
          lockedFromAbsence: true,
          status: WorkforceTimesheetEntryStatus.DRAFT,
        },
      ])
      .mockResolvedValue([]);
    prisma.workforceTimesheetEntry.update.mockResolvedValue({});
    prisma.workforceTimesheetEntry.upsert.mockResolvedValue({});
    await svc.syncAbsences(ORG, TS);
    expect(prisma.workforceTimesheetEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "orphan" },
        data: expect.objectContaining({ lockedFromAbsence: false }),
      }),
    );
    expect(prisma.workforceTimesheetEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          type: WorkforceTimesheetEntryType.SICK,
          lockedFromAbsence: true,
        }),
      }),
    );
  });

  it("unlockAbsenceRange restores weekday type", async () => {
    prisma.workforceTimesheetEntry.findMany.mockResolvedValue([
      {
        id: "e1",
        workDate: new Date("2026-08-03T00:00:00.000Z"),
        timesheet: { status: WorkforceTimesheetStatus.DRAFT },
      },
    ]);
    prisma.workforceTimesheetEntry.update.mockResolvedValue({});
    await svc.unlockAbsenceRange(
      ORG,
      EMP,
      new Date("2026-08-03T00:00:00.000Z"),
      new Date("2026-08-03T00:00:00.000Z"),
    );
    expect(prisma.workforceTimesheetEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockedFromAbsence: false,
          type: WorkforceTimesheetEntryType.WORK,
        }),
      }),
    );
  });

  it("approveMonth rejects empty timesheet", async () => {
    prisma.workforceTimesheet.findFirst.mockResolvedValue(sheet);
    prisma.workforceTimesheetEntry.findMany.mockResolvedValue([]);
    await expect(svc.approveMonth(ORG, TS, ACTOR)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("approveMonth emits WORKFORCE_TIMESHEET_APPROVED with entry type", async () => {
    prisma.workforceTimesheet.findFirst.mockResolvedValue(sheet);
    prisma.workforceTimesheet.update.mockResolvedValue({
      ...sheet,
      status: WorkforceTimesheetStatus.APPROVED,
    });
    prisma.workforceTimesheetEntry.updateMany.mockResolvedValue({ count: 1 });
    prisma.workforceTimesheetEntry.findMany
      .mockResolvedValueOnce([
        {
          id: "e1",
          employmentId: EMP,
          workDate: new Date("2026-08-03T00:00:00.000Z"),
          hours: 8,
          type: WorkforceTimesheetEntryType.VACATION,
          employment: { globalPersonId: "p1", financeEmployeeId: null },
        },
      ])
      .mockResolvedValueOnce([]);
    await svc.approveMonth(ORG, TS, ACTOR);
    expect(satelliteEvents.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          rows: [
            expect.objectContaining({
              type: WorkforceTimesheetEntryType.VACATION,
              hours: 8,
            }),
          ],
        }),
      }),
    );
  });

  it("approveBatch returns 410 Gone", async () => {
    await expect(svc.approveBatch(ORG, ACTOR, ["e1"])).rejects.toBeInstanceOf(
      GoneException,
    );
  });
});
