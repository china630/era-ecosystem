import { WorkforceOrgSyncService } from "./workforce-org-sync.service";

describe("WorkforceOrgSyncService", () => {
  const orgId = "660e8400-e29b-41d4-a716-446655440001";
  const cpOrgUnitId = "550e8400-e29b-41d4-a716-446655440000";

  it("upserts Department mirror on WORKFORCE_ORG_UNIT_UPSERTED", async () => {
    const prisma = {
      department: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: "d1", cpOrgUnitId }),
      },
    };
    const subscriptionAccess = { hasModule: jest.fn().mockResolvedValue(true) };
    const svc = new WorkforceOrgSyncService(
      prisma as never,
      subscriptionAccess as never,
      { ensureOrganization: jest.fn() } as never,
      { enqueueManualLifecycle: jest.fn() } as never,
    );

    const result = await svc.handleOrgUnitUpserted(orgId, {
      type: "WORKFORCE_ORG_UNIT_UPSERTED",
      organizationId: orgId,
      correlationId: `${cpOrgUnitId}:UPSERT:1`,
      occurredAt: "2026-06-01T00:00:00.000Z",
      payload: {
        cpOrgUnitId,
        workforceScopeId: "770e8400-e29b-41d4-a716-446655440002",
        anchorOrganizationId: orgId,
        name: "Med Block",
        costCenterCode: "MED-01",
      },
    });

    expect(prisma.department.upsert).toHaveBeenCalled();
    expect(result.meta).toEqual({ departmentId: "d1", cpOrgUnitId });
  });

  it("skips org unit upsert when org lacks hr_full", async () => {
    const subscriptionAccess = { hasModule: jest.fn().mockResolvedValue(false) };
    const svc = new WorkforceOrgSyncService(
      {} as never,
      subscriptionAccess as never,
      { ensureOrganization: jest.fn() } as never,
      { enqueueManualLifecycle: jest.fn() } as never,
    );
    const result = await svc.handleOrgUnitUpserted(orgId, {
      type: "WORKFORCE_ORG_UNIT_UPSERTED",
      organizationId: orgId,
      correlationId: "c1",
      occurredAt: "2026-06-01T00:00:00.000Z",
      payload: {
        cpOrgUnitId,
        workforceScopeId: "770e8400-e29b-41d4-a716-446655440002",
        anchorOrganizationId: orgId,
        name: "HQ",
      },
    });
    expect(result.meta).toEqual({ skipped: true, reason: "no_hr_full" });
  });

  it("throws when department mirror missing on POSITION_UPSERTED", async () => {
    const { WorkforceMirrorMissingError } = await import(
      "./workforce-mirror-missing.error"
    );
    const prisma = {
      department: { findFirst: jest.fn().mockResolvedValue(null) },
      jobPosition: { upsert: jest.fn() },
    };
    const svc = new WorkforceOrgSyncService(
      prisma as never,
      { hasModule: jest.fn().mockResolvedValue(true) } as never,
      { ensureOrganization: jest.fn() } as never,
      { enqueueManualLifecycle: jest.fn() } as never,
    );
    await expect(
      svc.handlePositionUpserted(orgId, {
        type: "WORKFORCE_POSITION_UPSERTED",
        organizationId: orgId,
        correlationId: "c2",
        occurredAt: "2026-06-01T00:00:00.000Z",
        payload: {
          cpPositionId: "550e8400-e29b-41d4-a716-446655440099",
          cpOrgUnitId,
          organizationId: orgId,
          workforceScopeId: "770e8400-e29b-41d4-a716-446655440002",
          name: "Cleaner",
          totalSlots: 10,
        },
      }),
    ).rejects.toBeInstanceOf(WorkforceMirrorMissingError);
    expect(prisma.jobPosition.upsert).not.toHaveBeenCalled();
  });

  it("enqueues ƏMAS TRANSFER after employment transfer mirror", async () => {
    const cpEmploymentId = "550e8400-e29b-41d4-a716-446655440010";
    const toPositionId = "550e8400-e29b-41d4-a716-446655440011";
    const employeeId = "550e8400-e29b-41d4-a716-446655440012";
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({ id: employeeId }),
        update: jest.fn().mockResolvedValue({ id: employeeId }),
      },
      jobPosition: {
        findFirst: jest.fn().mockResolvedValue({
          id: "jp1",
          name: "Senior Cleaner",
          cpPositionId: toPositionId,
        }),
      },
    };
    const enqueueManualLifecycle = jest.fn().mockResolvedValue({ enqueued: true });
    const svc = new WorkforceOrgSyncService(
      prisma as never,
      { hasModule: jest.fn().mockResolvedValue(true) } as never,
      { ensureOrganization: jest.fn() } as never,
      { enqueueManualLifecycle } as never,
    );
    const result = await svc.handleEmploymentTransferred(orgId, {
      type: "WORKFORCE_EMPLOYMENT_TRANSFERRED",
      organizationId: orgId,
      correlationId: "c-transfer",
      occurredAt: "2026-06-01T00:00:00.000Z",
      globalPersonId: "550e8400-e29b-41d4-a716-446655440013",
      payload: {
        cpEmploymentId,
        organizationId: orgId,
        globalPersonId: "550e8400-e29b-41d4-a716-446655440013",
        toOrgUnitId: cpOrgUnitId,
        toPositionId,
      },
    });
    expect(prisma.employee.update).toHaveBeenCalled();
    expect(enqueueManualLifecycle).toHaveBeenCalledWith(
      orgId,
      employeeId,
      "TRANSFER",
      expect.objectContaining({
        toPositionId,
        toPositionName: "Senior Cleaner",
      }),
    );
    expect(result.meta).toEqual({ employeeId, cpEmploymentId });
  });
});
