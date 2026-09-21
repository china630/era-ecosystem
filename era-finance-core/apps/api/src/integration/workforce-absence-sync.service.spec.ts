import { WorkforceAbsenceSyncService } from "./workforce-absence-sync.service";
import { WorkforceMirrorMissingError } from "./workforce-mirror-missing.error";

describe("WorkforceAbsenceSyncService", () => {
  const orgId = "660e8400-e29b-41d4-a716-446655440001";
  const employmentId = "770e8400-e29b-41d4-a716-446655440002";
  const personId = "880e8400-e29b-41d4-a716-446655440003";
  const cpAbsenceId = "550e8400-e29b-41d4-a716-446655440000";

  function approvedEvent(extra?: { financeEmployeeId?: string }) {
    return {
      type: "WORKFORCE_ABSENCE_APPROVED" as const,
      organizationId: orgId,
      correlationId: "c1",
      occurredAt: "2026-06-01T00:00:00.000Z",
      globalPersonId: personId,
      payload: {
        cpAbsenceId,
        organizationId: orgId,
        employmentId,
        globalPersonId: personId,
        kind: "VACATION" as const,
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        ...(extra?.financeEmployeeId
          ? { financeEmployeeId: extra.financeEmployeeId }
          : {}),
      },
    };
  }

  it("skips approved event when org lacks hr_full", async () => {
    const subscriptionAccess = {
      hasModule: jest.fn().mockResolvedValue(false),
    };
    const svc = new WorkforceAbsenceSyncService(
      {} as never,
      {} as never,
      subscriptionAccess as never,
    );
    const result = await svc.handleApproved(orgId, approvedEvent());
    expect(result.meta).toEqual({ skipped: true, reason: "no_hr_full" });
  });

  it("resolves Employee by cpEmploymentId when financeEmployeeId missing", async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({ id: "fin-emp-1" }),
      },
      absence: {
        upsert: jest.fn().mockResolvedValue({ id: "abs-1" }),
      },
    };
    const absenceTypes = {
      listOrSeed: jest.fn().mockResolvedValue([
        { id: "type-1", code: "LABOR_LEAVE" },
      ]),
    };
    const svc = new WorkforceAbsenceSyncService(
      prisma as never,
      absenceTypes as never,
      { hasModule: jest.fn().mockResolvedValue(true) } as never,
    );

    const result = await svc.handleApproved(orgId, approvedEvent());

    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: orgId,
        deletedAt: null,
        OR: [{ cpEmploymentId: employmentId }],
      },
    });
    expect(prisma.absence.upsert).toHaveBeenCalled();
    expect(result.meta).toEqual({
      cpAbsenceId,
      absenceId: "abs-1",
      action: "upserted",
    });
  });

  it("throws when Employee mirror missing (retry, do not bury)", async () => {
    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue(null) },
      absence: { upsert: jest.fn() },
    };
    const svc = new WorkforceAbsenceSyncService(
      prisma as never,
      {} as never,
      { hasModule: jest.fn().mockResolvedValue(true) } as never,
    );
    await expect(
      svc.handleApproved(orgId, approvedEvent()),
    ).rejects.toBeInstanceOf(WorkforceMirrorMissingError);
    expect(prisma.absence.upsert).not.toHaveBeenCalled();
  });
});
