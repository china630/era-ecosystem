import {
  handleStaffProvisionEvent,
  SatelliteLoginTakenError,
  UnknownSatelliteRoleError,
} from "@/lib/staff-provision";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    role: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
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

jest.mock("@/lib/auth/ensure-system-retail-roles", () => ({
  ensureSystemRoles: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@era/satellite-kit", () => ({
  hashPassword: async (password: string) => `salt:${password}`,
}));

const CP_EMPLOYMENT_ID = "550e8400-e29b-41d4-a716-446655440000";
const ORG_ID = "770e8400-e29b-41d4-a716-446655440002";

describe("retail staff-provision", () => {
  const provisionEvent = {
    type: "STAFF_PROVISIONED",
    organizationId: ORG_ID,
    correlationId: "corr-1",
    occurredAt: new Date().toISOString(),
    globalPersonId: "880e8400-e29b-41d4-a716-446655440003",
    payload: {
      cpEmploymentId: CP_EMPLOYMENT_ID,
      satelliteKey: "industry_retail",
      satelliteRole: "CASHIER",
      staffCode: "FINEMP1",
      fullName: "Cash Desk",
      login: "emp-cash",
      pin: "1234",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.role.findFirst.mockResolvedValue({ id: "role-1", code: "CASHIER" });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "user-1" });
  });

  it("creates a cashier bound to the control-plane employment", async () => {
    const result = await handleStaffProvisionEvent(provisionEvent);
    expect(result).toEqual({ satelliteUserId: "user-1" });
    const { prisma } = jest.requireMock("@/lib/prisma");
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          login: "emp-cash",
          passwordHash: "salt:1234",
          cpEmploymentId: CP_EMPLOYMENT_ID,
          roleId: "role-1",
        }),
      }),
    );
  });

  it("looks up the role by the code that arrived", async () => {
    await handleStaffProvisionEvent({
      ...provisionEvent,
      payload: { ...provisionEvent.payload, satelliteRole: "CASHIER" },
    });
    const { prisma } = jest.requireMock("@/lib/prisma");
    expect(prisma.role.findFirst).toHaveBeenCalledWith({
      where: { organizationId: ORG_ID, code: "CASHIER" },
    });
  });

  it("throws when the role row is missing", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.role.findFirst.mockResolvedValue(null);
    await expect(handleStaffProvisionEvent(provisionEvent)).rejects.toBeInstanceOf(
      UnknownSatelliteRoleError,
    );
  });

  it("refuses a login owned by another employment", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.user.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "other", cpEmploymentId: "someone-else" });
    await expect(handleStaffProvisionEvent(provisionEvent)).rejects.toBeInstanceOf(
      SatelliteLoginTakenError,
    );
  });

  it("disables the user on STAFF_DEACTIVATED", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.user.findFirst.mockResolvedValue({ id: "user-1" });
    const result = await handleStaffProvisionEvent({
      type: "STAFF_DEACTIVATED",
      organizationId: ORG_ID,
      correlationId: "corr-2",
      occurredAt: new Date().toISOString(),
      payload: {
        cpEmploymentId: CP_EMPLOYMENT_ID,
        satelliteKey: "industry_retail",
        staffCode: "FINEMP1",
        satelliteUserId: "user-1",
        roleBindingId: "660e8400-e29b-41d4-a716-446655440099",
      },
    });
    expect(result).toEqual({ ok: true });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { status: "DISABLED" },
    });
  });
});
