import { TimesheetEntryType } from "@erafinance/database";
import { WorkforceTimesheetSyncService } from "./workforce-timesheet-sync.service";

const ORG = "660e8400-e29b-41d4-a716-446655440001";
const EMP_CP = "770e8400-e29b-41d4-a716-446655440002";
const PERSON = "880e8400-e29b-41d4-a716-446655440003";
const ENTRY = "990e8400-e29b-41d4-a716-446655440004";
const ACTOR = "aa0e8400-e29b-41d4-a716-446655440005";
const FIN_EMP = "bb0e8400-e29b-41d4-a716-446655440006";

function approvedEvent(rows: Array<{ type?: string; workDate: string }>) {
  return {
    type: "WORKFORCE_TIMESHEET_APPROVED",
    organizationId: ORG,
    correlationId: "c1",
    occurredAt: "2026-08-31T00:00:00.000Z",
    payload: {
      organizationId: ORG,
      cpTimesheetEntryIds: [ENTRY],
      approvedByUserId: ACTOR,
      approvedAt: "2026-08-31T00:00:00.000Z",
      rows: rows.map((r) => ({
        cpTimesheetEntryId: ENTRY,
        cpEmploymentId: EMP_CP,
        globalPersonId: PERSON,
        workDate: r.workDate,
        hours: 8,
        type: r.type,
      })),
    },
  };
}

describe("WorkforceTimesheetSyncService", () => {
  it("maps VACATION and SICK onto Finance timesheet entries", async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({ id: FIN_EMP }),
      },
      timesheetEntry: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const subscriptionAccess = { hasModule: jest.fn().mockResolvedValue(true) };
    const timesheet = {
      getOrCreate: jest.fn().mockResolvedValue({ timesheet: { id: "ts-1" } }),
    };
    const svc = new WorkforceTimesheetSyncService(
      prisma as never,
      subscriptionAccess as never,
      timesheet as never,
    );

    const result = await svc.handleApproved(
      ORG,
      approvedEvent([
        { type: "VACATION", workDate: "2026-08-10" },
        { type: "SICK", workDate: "2026-08-11" },
      ]),
    );

    expect(result.meta).toEqual({ mirrored: 2 });
    const types = prisma.timesheetEntry.upsert.mock.calls.map(
      (c: [{ create: { type: TimesheetEntryType } }]) => c[0].create.type,
    );
    expect(types).toEqual([
      TimesheetEntryType.VACATION,
      TimesheetEntryType.SICK,
    ]);
  });

  it("defaults missing type to WORK", async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({ id: FIN_EMP }),
      },
      timesheetEntry: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const subscriptionAccess = { hasModule: jest.fn().mockResolvedValue(true) };
    const timesheet = {
      getOrCreate: jest.fn().mockResolvedValue({ timesheet: { id: "ts-1" } }),
    };
    const svc = new WorkforceTimesheetSyncService(
      prisma as never,
      subscriptionAccess as never,
      timesheet as never,
    );

    await svc.handleApproved(
      ORG,
      approvedEvent([{ workDate: "2026-08-03" }]),
    );

    expect(prisma.timesheetEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ type: TimesheetEntryType.WORK }),
      }),
    );
  });
});
