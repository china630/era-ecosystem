import { handleStaffProvisionEvent } from "@/lib/staff-provision";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    role: { findFirst: jest.fn(), create: jest.fn() },
    user: {
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

describe("hotel staff-provision", () => {
  const provisionEvent = {
    type: "STAFF_PROVISIONED",
    organizationId: ORG_ID,
    correlationId: "corr-1",
    occurredAt: new Date().toISOString(),
    globalPersonId: "880e8400-e29b-41d4-a716-446655440003",
    payload: {
      cpEmploymentId: CP_EMPLOYMENT_ID,
      satelliteKey: "industry_hotel_pms",
      satelliteRole: "RECEPTION",
      staffCode: "FINEMP1",
      fullName: "Front Desk",
      login: "emp-front",
      pin: "1234",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.role.findFirst.mockResolvedValue({ id: "role-1", code: "Receptionist" });
    prisma.role.create.mockResolvedValue({ id: "role-new", code: "Receptionist" });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "user-1" });
  });

  it("creates user with organizationId and scrypt-shaped passwordHash", async () => {
    const result = await handleStaffProvisionEvent(provisionEvent);
    expect(result).toEqual({ satelliteUserId: "user-1" });
    const { prisma } = jest.requireMock("@/lib/prisma");
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          login: "emp-front",
          passwordHash: "salt:1234",
          cpEmploymentId: CP_EMPLOYMENT_ID,
          roleId: "role-1",
        }),
      }),
    );
    expect(prisma.role.findFirst).toHaveBeenCalledWith({ where: { code: "Receptionist" } });
    expect(prisma.role.create).not.toHaveBeenCalled();
  });

  it("ensures Receptionist role when missing (no seed)", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.role.findFirst.mockResolvedValue(null);
    const result = await handleStaffProvisionEvent(provisionEvent);
    expect(result).toEqual({ satelliteUserId: "user-1" });
    expect(prisma.role.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "Receptionist",
          permissionsJson: expect.any(String),
        }),
      }),
    );
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roleId: "role-new" }),
      }),
    );
  });

  it("deactivates user on STAFF_DEACTIVATED", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    await handleStaffProvisionEvent({
      type: "STAFF_DEACTIVATED",
      organizationId: ORG_ID,
      correlationId: "corr-2",
      occurredAt: new Date().toISOString(),
      payload: {
        cpEmploymentId: CP_EMPLOYMENT_ID,
        satelliteKey: "industry_hotel_pms",
        staffCode: "FINEMP1",
        satelliteUserId: "user-1",
      },
    });
    expect(prisma.user.updateMany).toHaveBeenCalled();
  });
});
