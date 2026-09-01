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
    orgUnit: { name: "Front office" },
    position: { name: "Receptionist" },
  };

  const prisma = {
    workforceEmployment: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    workforceRoleBinding: { findMany: jest.fn(), update: jest.fn() },
  };
  const mdm = { getPersonOpsProfile: jest.fn() };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const scope = { resolveScopeForCommercialOrg: jest.fn() };
  const positions = { assertSlotAvailable: jest.fn() };
  const templates = { resolveRole: jest.fn() };
  const seats = { assertSeatAvailable: jest.fn() };
  const audit = { log: jest.fn() };
  const satelliteEvents = { enqueue: jest.fn() };
  const subscriptionAccess = { hasModule: jest.fn() };

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
    prisma.workforceEmployment.update.mockResolvedValue(employment);
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
});
