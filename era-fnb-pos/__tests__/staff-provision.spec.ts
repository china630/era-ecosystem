import {
  handleStaffProvisionEvent,
  SatelliteLoginTakenError,
} from "@/lib/staff-provision";

jest.mock("@era/satellite-kit", () => ({
  hashPassword: jest.fn(async (p: string) => `salt:${p}`),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    role: { findFirst: jest.fn() },
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    staffRoster: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/request-organization", () => ({
  requestOrganizationId: () => "770e8400-e29b-41d4-a716-446655440002",
  enterRequestTenant: jest.fn(),
}));

const CP_EMPLOYMENT_ID = "550e8400-e29b-41d4-a716-446655440000";
const ORG_ID = "770e8400-e29b-41d4-a716-446655440002";

describe("fnb staff-provision", () => {
  const provisionEvent = {
    type: "STAFF_PROVISIONED",
    organizationId: ORG_ID,
    correlationId: "corr-1",
    occurredAt: new Date().toISOString(),
    globalPersonId: "880e8400-e29b-41d4-a716-446655440003",
    payload: {
      cpEmploymentId: CP_EMPLOYMENT_ID,
      satelliteKey: "industry_fnb_pos",
      satelliteRole: "WAITER",
      staffCode: "FINEMP1",
      fullName: "Waiter One",
      login: "emp-wait",
      pin: "1234",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.role.findFirst.mockResolvedValue({ id: "role-1", code: "FB_WAITER" });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "user-1" });
    prisma.staffRoster.findFirst.mockResolvedValue(null);
    prisma.staffRoster.create.mockResolvedValue({ id: "roster-1" });
  });

  it("stamps organizationId and uses scrypt for User, SHA-256 for PIN roster", async () => {
    const result = await handleStaffProvisionEvent(provisionEvent);
    expect(result).toEqual({ satelliteUserId: "user-1" });
    const { prisma } = jest.requireMock("@/lib/prisma");
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          login: "emp-wait",
          passwordHash: "salt:1234",
        }),
      }),
    );
    expect(prisma.role.findFirst).toHaveBeenCalledWith({ where: { code: "FB_WAITER" } });
    expect(prisma.staffRoster.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          staffCode: "FINEMP1",
        }),
      }),
    );
    const rosterData = prisma.staffRoster.create.mock.calls[0][0].data;
    expect(rosterData.pinHash).not.toBe("salt:1234");
    expect(rosterData.pinHash).toHaveLength(64);
  });

  it("throws SatelliteLoginTakenError when login belongs to another cpEmploymentId", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.user.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "user-other",
        cpEmploymentId: "other-cp-id",
        login: "emp-wait",
      });

    await expect(handleStaffProvisionEvent(provisionEvent)).rejects.toBeInstanceOf(
      SatelliteLoginTakenError,
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("deactivates only satelliteUserId on STAFF_DEACTIVATED", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.user.findFirst.mockResolvedValue({ id: "user-1" });
    await handleStaffProvisionEvent({
      type: "STAFF_DEACTIVATED",
      organizationId: ORG_ID,
      correlationId: "corr-2",
      occurredAt: new Date().toISOString(),
      payload: {
        cpEmploymentId: CP_EMPLOYMENT_ID,
        satelliteKey: "industry_fnb_pos",
        staffCode: "FINEMP1",
        satelliteUserId: "user-1",
      },
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { status: "INACTIVE" },
    });
    expect(prisma.staffRoster.updateMany).toHaveBeenCalledWith({
      where: { cpEmploymentId: CP_EMPLOYMENT_ID },
      data: { active: false },
    });
  });
});
