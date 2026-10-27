import { SATELLITE_STAFF_DEACTIVATED, SATELLITE_STAFF_PROVISIONED } from "@era/contracts";
import { WorkforceProvisionService } from "./workforce-provision.service";

const ORG = "44444444-4444-4444-8444-444444444444";
const EMP = "08e0a901-1234-4678-9abc-def012345678";

describe("WorkforceProvisionService.reprovision", () => {
  const employment = {
    id: EMP,
    globalPersonId: "11111111-1111-4111-8111-111111111111",
    financeEmployeeId: null,
    satelliteStaffLogin: "emp-08e0a901",
    satelliteStaffPin: "0000",
    positionId: "33333333-3333-4333-8333-333333333333",
    workforceScopeId: "scope1",
    orgUnit: { name: "Front office" },
    position: { name: "Receptionist" },
  };

  const prisma = {
    workforceEmployment: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    workforceRoleBinding: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    workforceManualGrant: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    workforceSeatAllocation: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const mdm = { getPersonOpsProfile: jest.fn() };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const scope = { resolveScopeForCommercialOrg: jest.fn() };
  const positions = { assertSlotAvailable: jest.fn() };
  const templates = { resolveRole: jest.fn() };
  const seats = { assertSeatAvailable: jest.fn(), allocateSeat: jest.fn() };
  const audit = { log: jest.fn() };
  const satelliteEvents = { enqueue: jest.fn() };
  const subscriptionAccess = { hasModule: jest.fn() };
  const personnelOrders = {
    ensureDraftForMutation: jest.fn().mockResolvedValue(null),
    assertTerminateAllowed: jest.fn().mockResolvedValue(undefined),
  };

  const svc = new WorkforceProvisionService(
    prisma as never,
    mdm as never,
    entitlement as never,
    scope as never,
    positions as never,
    templates as never,
    seats as never,
    audit as never,
    satelliteEvents as never,
    subscriptionAccess as never,
    personnelOrders as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.workforceEmployment.findFirst.mockResolvedValue(employment);
    prisma.workforceRoleBinding.findMany.mockResolvedValue([
      { id: "bind-1", satelliteKey: "industry_hotel_pms", satelliteRole: "RECEPTION" },
    ]);
    scope.resolveScopeForCommercialOrg.mockResolvedValue({
      workforceScope: { anchorOrganizationId: ORG },
    });
    mdm.getPersonOpsProfile.mockResolvedValue({ fullName: "Test User" });
    audit.log.mockResolvedValue(undefined);
    satelliteEvents.enqueue.mockResolvedValue({ jobId: "j1" });
    prisma.workforceSeatAllocation.findFirst.mockResolvedValue({ id: "seat1" });
    prisma.workforceSeatAllocation.updateMany.mockResolvedValue({ count: 0 });
    prisma.workforceRoleBinding.count.mockResolvedValue(1);
    prisma.workforceRoleBinding.upsert.mockResolvedValue({
      id: "bind-new",
      satelliteKey: "industry_clinic",
      satelliteRole: "RECEPTION",
    });
    prisma.workforceRoleBinding.update.mockResolvedValue({});
    prisma.workforceManualGrant.findMany.mockResolvedValue([]);
    prisma.workforceManualGrant.updateMany.mockResolvedValue({ count: 0 });
  });

  it("rejects login save when no active bindings", async () => {
    prisma.workforceRoleBinding.findMany.mockResolvedValue([]);

    await expect(
      svc.reprovision(ORG, EMP, "actor", { login: "new.login" }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "LOGIN_REQUIRES_BINDING" }),
    });
    expect(prisma.workforceEmployment.update).not.toHaveBeenCalled();
  });

  it("rejects duplicate login for another active employment", async () => {
    prisma.workforceEmployment.findFirst
      .mockResolvedValueOnce(employment)
      .mockResolvedValueOnce({ id: "other-emp" });

    await expect(
      svc.reprovision(ORG, EMP, "actor", { login: "taken.login" }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "LOGIN_TAKEN" }),
    });
    expect(prisma.workforceEmployment.update).not.toHaveBeenCalled();
  });

  it("saves login and reprovisions when bindings exist", async () => {
    prisma.workforceEmployment.findFirst
      .mockResolvedValueOnce(employment)
      .mockResolvedValueOnce(null);

    const result = await svc.reprovision(ORG, EMP, "actor", {
      login: "new.login",
      pin: "4321",
    });

    expect(result).toEqual({ reprovisioned: 1, cpSaved: true });
    expect(prisma.workforceEmployment.update).toHaveBeenCalledWith({
      where: { id: EMP },
      data: {
        satelliteStaffLogin: "new.login",
        satelliteStaffPin: "4321",
      },
    });
    expect(satelliteEvents.enqueue).toHaveBeenCalled();
  });

  it("reprovisions without cpSaved when no login/pin override", async () => {
    const result = await svc.reprovision(ORG, EMP, "actor");

    expect(result).toEqual({ reprovisioned: 1, cpSaved: false });
    expect(prisma.workforceEmployment.update).not.toHaveBeenCalled();
  });

  it("revokes a hire-default satellite and emits STAFF_DEACTIVATED", async () => {
    const hotel = {
      id: "bind-hotel",
      satelliteKey: "industry_hotel_pms",
      satelliteRole: "RECEPTION",
      satelliteUserId: "sat-user-1",
    };
    const clinic = {
      id: "bind-clinic",
      satelliteKey: "industry_clinic",
      satelliteRole: "RECEPTION",
      satelliteUserId: "sat-user-2",
      manualGrantId: null,
    };
    prisma.workforceRoleBinding.findMany
      .mockResolvedValueOnce([hotel, clinic])
      .mockResolvedValueOnce([hotel]);
    prisma.workforceRoleBinding.count.mockResolvedValue(1);
    subscriptionAccess.hasModule.mockResolvedValue(true);

    const result = await svc.reprovision(ORG, EMP, "actor", {
      satelliteKeys: ["industry_hotel_pms"],
    });

    expect(result.reprovisioned).toBe(1);
    expect(prisma.workforceRoleBinding.update).toHaveBeenCalledWith({
      where: { id: "bind-clinic" },
      data: { status: "REVOKED" },
    });
    expect(prisma.workforceManualGrant.updateMany).toHaveBeenCalledWith({
      where: {
        employmentId: EMP,
        satelliteKey: "industry_clinic",
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(
      satelliteEvents.enqueue.mock.calls.some(
        (c: [{ type: string }]) => c[0].type === SATELLITE_STAFF_DEACTIVATED,
      ),
    ).toBe(true);
    expect(
      satelliteEvents.enqueue.mock.calls.some(
        (c: [{ payload?: { satelliteKey?: string } }]) =>
          c[0].payload?.satelliteKey === "industry_clinic",
      ),
    ).toBe(true);
  });

  it("revokes the linked manual grant when a satellite is unchecked", async () => {
    const grantId = "grant-clinic-admin";
    const hotel = {
      id: "bind-hotel",
      satelliteKey: "industry_hotel_pms",
      satelliteRole: "RECEPTION",
      satelliteUserId: "sat-user-1",
      manualGrantId: null,
    };
    const clinic = {
      id: "bind-clinic",
      satelliteKey: "industry_clinic",
      satelliteRole: "CLINIC_ADMIN",
      satelliteUserId: "sat-user-2",
      manualGrantId: grantId,
    };
    prisma.workforceRoleBinding.findMany
      .mockResolvedValueOnce([hotel, clinic])
      .mockResolvedValueOnce([hotel]);
    prisma.workforceRoleBinding.count.mockResolvedValue(1);
    subscriptionAccess.hasModule.mockResolvedValue(true);

    await svc.reprovision(ORG, EMP, "actor", {
      satelliteKeys: ["industry_hotel_pms"],
    });

    expect(prisma.workforceManualGrant.updateMany).toHaveBeenCalledWith({
      where: { id: grantId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.workforceManualGrant.updateMany).toHaveBeenCalledWith({
      where: {
        employmentId: EMP,
        satelliteKey: "industry_clinic",
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("heals an active grant whose binding was revoked before emitting", async () => {
    const grantId = "grant-clinic-admin";
    prisma.workforceManualGrant.findMany.mockResolvedValue([
      {
        id: grantId,
        employmentId: EMP,
        satelliteKey: "industry_clinic",
        satelliteRole: "CLINIC_ADMIN",
        revokedAt: null,
      },
    ]);
    prisma.workforceRoleBinding.upsert.mockResolvedValue({
      id: "bind-admin",
      satelliteKey: "industry_clinic",
      satelliteRole: "CLINIC_ADMIN",
      source: "MANUAL_GRANT",
    });
    prisma.workforceRoleBinding.findMany.mockResolvedValue([
      {
        id: "bind-admin",
        satelliteKey: "industry_clinic",
        satelliteRole: "CLINIC_ADMIN",
        source: "MANUAL_GRANT",
        updatedAt: new Date("2026-10-26T08:00:00.000Z"),
      },
    ]);

    const result = await svc.reprovision(ORG, EMP, "actor");

    expect(prisma.workforceRoleBinding.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          employmentId_satelliteKey_satelliteRole: {
            employmentId: EMP,
            satelliteKey: "industry_clinic",
            satelliteRole: "CLINIC_ADMIN",
          },
        },
        update: expect.objectContaining({
          status: "ACTIVE",
          source: "MANUAL_GRANT",
          manualGrantId: grantId,
        }),
      }),
    );
    expect(result.reprovisioned).toBe(1);
    expect(
      satelliteEvents.enqueue.mock.calls.some(
        (c: [{ type: string; payload?: { satelliteRole?: string } }]) =>
          c[0].type === SATELLITE_STAFF_PROVISIONED &&
          c[0].payload?.satelliteRole === "CLINIC_ADMIN",
      ),
    ).toBe(true);
  });

  it("emits MANUAL_GRANT after HIRE_DEFAULT so the grant role is the last write", async () => {
    const now = new Date("2026-10-27T12:00:00.000Z");
    prisma.workforceRoleBinding.findMany.mockResolvedValue([
      {
        id: "bind-admin",
        satelliteKey: "industry_clinic",
        satelliteRole: "CLINIC_ADMIN",
        source: "MANUAL_GRANT",
        updatedAt: now,
      },
      {
        id: "bind-reception",
        satelliteKey: "industry_clinic",
        satelliteRole: "RECEPTION",
        source: "HIRE_DEFAULT",
        updatedAt: now,
      },
    ]);

    await svc.reprovision(ORG, EMP, "actor");

    const provisioned = satelliteEvents.enqueue.mock.calls
      .map((c: [{ type: string; payload?: { satelliteRole?: string } }]) => c[0])
      .filter((e) => e.type === SATELLITE_STAFF_PROVISIONED)
      .map((e) => e.payload?.satelliteRole);
    expect(provisioned).toEqual(["RECEPTION", "CLINIC_ADMIN"]);
  });

  it("adds a satellite, allocates no extra seat, and emits STAFF_PROVISIONED", async () => {
    const hotel = {
      id: "bind-hotel",
      satelliteKey: "industry_hotel_pms",
      satelliteRole: "RECEPTION",
      satelliteUserId: "sat-user-1",
    };
    prisma.workforceRoleBinding.findMany
      .mockResolvedValueOnce([hotel])
      .mockResolvedValueOnce([
        hotel,
        { id: "bind-new", satelliteKey: "industry_clinic", satelliteRole: "RECEPTION" },
      ]);
    templates.resolveRole.mockResolvedValue("RECEPTION");
    subscriptionAccess.hasModule.mockResolvedValue(true);

    const result = await svc.reprovision(ORG, EMP, "actor", {
      satelliteKeys: ["industry_hotel_pms", "industry_clinic"],
    });

    expect(result.reprovisioned).toBe(2);
    expect(prisma.workforceRoleBinding.upsert).toHaveBeenCalled();
    expect(seats.allocateSeat).not.toHaveBeenCalled();
    expect(
      satelliteEvents.enqueue.mock.calls.some(
        (c: [{ type: string }]) => c[0].type === SATELLITE_STAFF_PROVISIONED,
      ),
    ).toBe(true);
  });

  it("clears all satellites without LOGIN_REQUIRES_BINDING when satelliteKeys is empty", async () => {
    prisma.workforceRoleBinding.findMany
      .mockResolvedValueOnce([
        {
          id: "bind-hotel",
          satelliteKey: "industry_hotel_pms",
          satelliteRole: "STAFF",
          satelliteUserId: "sat-user-1",
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.workforceRoleBinding.count.mockResolvedValue(0);
    subscriptionAccess.hasModule.mockResolvedValue(true);

    const result = await svc.reprovision(ORG, EMP, "actor", {
      login: "keep.login",
      satelliteKeys: [],
    });

    expect(result).toEqual({ reprovisioned: 0, cpSaved: false });
    expect(prisma.workforceEmployment.update).not.toHaveBeenCalled();
    expect(prisma.workforceSeatAllocation.updateMany).toHaveBeenCalled();
  });
});
