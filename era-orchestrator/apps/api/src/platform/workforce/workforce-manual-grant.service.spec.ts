import { SATELLITE_STAFF_DEACTIVATED } from "@era/contracts";
import { RoleBindingStatus } from "@era365/database";
import { WorkforceManualGrantService } from "./workforce-manual-grant.service";

const ORG = "44444444-4444-4444-8444-444444444444";
const EMP = "08e0a901-1234-4678-9abc-def012345678";
const GRANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BINDING_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("WorkforceManualGrantService", () => {
  const prisma = {
    workforceEmployment: { findMany: jest.fn(), findFirst: jest.fn() },
    workforceManualGrant: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    workforceRoleBinding: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const scope = {
    resolveScopeForCommercialOrg: jest.fn().mockResolvedValue({
      workforceScope: { anchorOrganizationId: ORG },
    }),
  };
  const audit = { log: jest.fn() };
  const satelliteEvents = { enqueue: jest.fn() };
  const subscriptionAccess = { hasModule: jest.fn().mockResolvedValue(true) };
  const provision = { reprovision: jest.fn() };

  const svc = new WorkforceManualGrantService(
    prisma as never,
    entitlement as never,
    scope as never,
    audit as never,
    satelliteEvents as never,
    subscriptionAccess as never,
    provision as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    entitlement.assertWorkforceHub.mockResolvedValue(undefined);
    audit.log.mockResolvedValue(undefined);
    provision.reprovision.mockResolvedValue({ reprovisioned: 1 });
    satelliteEvents.enqueue.mockResolvedValue({ jobId: "j1" });
  });

  it("revoke with remaining bindings reprovisions instead of deactivate", async () => {
    prisma.workforceManualGrant.findUnique.mockResolvedValue({
      id: GRANT_ID,
      employmentId: EMP,
      satelliteKey: "industry_hotel_pms",
      satelliteRole: "MANAGER",
      revokedAt: null,
      employment: {
        organizationId: ORG,
        globalPersonId: "person-1",
        status: "ACTIVE",
      },
    });
    prisma.workforceRoleBinding.findFirst.mockResolvedValue({
      id: BINDING_ID,
      satelliteUserId: "user-1",
    });
    prisma.workforceRoleBinding.count.mockResolvedValue(1);

    const result = await svc.revoke(ORG, GRANT_ID, "actor");

    expect(result).toEqual({ ok: true });
    expect(satelliteEvents.enqueue).not.toHaveBeenCalled();
    expect(provision.reprovision).toHaveBeenCalledWith(ORG, EMP, "actor");
  });

  it("revoke last binding on satellite emits STAFF_DEACTIVATED", async () => {
    prisma.workforceManualGrant.findUnique.mockResolvedValue({
      id: GRANT_ID,
      employmentId: EMP,
      satelliteKey: "industry_hotel_pms",
      satelliteRole: "RECEPTION",
      revokedAt: null,
      employment: {
        organizationId: ORG,
        globalPersonId: "person-1",
        status: "ACTIVE",
      },
    });
    prisma.workforceRoleBinding.findFirst.mockResolvedValue({
      id: BINDING_ID,
      satelliteUserId: "user-1",
    });
    prisma.workforceRoleBinding.count.mockResolvedValue(0);

    await svc.revoke(ORG, GRANT_ID, "actor");

    expect(provision.reprovision).not.toHaveBeenCalled();
    expect(satelliteEvents.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ type: SATELLITE_STAFF_DEACTIVATED }),
    );
  });

  it("restore clears revokedAt and reprovisions", async () => {
    prisma.workforceManualGrant.findUnique.mockResolvedValue({
      id: GRANT_ID,
      employmentId: EMP,
      satelliteKey: "industry_clinic",
      satelliteRole: "DOCTOR",
      revokedAt: new Date(),
      employment: {
        organizationId: ORG,
        globalPersonId: "person-1",
        status: "ACTIVE",
      },
    });
    prisma.workforceRoleBinding.upsert.mockResolvedValue({
      id: BINDING_ID,
      status: RoleBindingStatus.ACTIVE,
    });

    const result = await svc.restore(ORG, GRANT_ID, "actor");

    expect(result).toEqual({ ok: true });
    expect(prisma.workforceManualGrant.update).toHaveBeenCalledWith({
      where: { id: GRANT_ID },
      data: { revokedAt: null },
    });
    expect(provision.reprovision).toHaveBeenCalledWith(ORG, EMP, "actor");
  });

  it("list applies satelliteKey, revoked, and search filters", async () => {
    prisma.workforceEmployment.findMany.mockResolvedValue([{ id: EMP }]);
    prisma.workforceManualGrant.findMany.mockResolvedValue([]);
    prisma.workforceManualGrant.count.mockResolvedValue(0);

    await svc.list(ORG, {
      satelliteKey: "industry_hotel_pms",
      revoked: false,
      search: "reception",
    });

    expect(prisma.workforceManualGrant.findMany).toHaveBeenCalledWith({
      where: {
        employmentId: { in: [EMP] },
        satelliteKey: "industry_hotel_pms",
        revokedAt: null,
        OR: [
          { reason: { contains: "reception", mode: "insensitive" } },
          {
            employment: {
              position: { name: { contains: "reception", mode: "insensitive" } },
            },
          },
          {
            employment: {
              orgUnit: { name: { contains: "reception", mode: "insensitive" } },
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 50,
    });
  });

  it("list returns empty when org has no employments", async () => {
    prisma.workforceEmployment.findMany.mockResolvedValue([]);
    const rows = await svc.list(ORG, { satelliteKey: "industry_clinic" });
    expect(rows).toEqual({ items: [], total: 0, page: 1, pageSize: 50 });
    expect(prisma.workforceManualGrant.findMany).not.toHaveBeenCalled();
  });
});
