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
    const svc = new WorkforceOrgSyncService(prisma as never, subscriptionAccess as never);

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
    const svc = new WorkforceOrgSyncService({} as never, subscriptionAccess as never);
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
});
