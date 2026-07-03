import { handleStaffProvisionEvent } from "@/lib/staff-provision";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    role: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    practitioner: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

const CP_EMPLOYMENT_ID = "550e8400-e29b-41d4-a716-446655440000";
const FIN_EMPLOYEE_ID = "660e8400-e29b-41d4-a716-446655440001";
const ORG_ID = "770e8400-e29b-41d4-a716-446655440002";
const GLOBAL_PERSON_ID = "880e8400-e29b-41d4-a716-446655440003";

describe("clinic staff-provision", () => {
  const provisionEvent = {
    type: "STAFF_PROVISIONED",
    organizationId: ORG_ID,
    correlationId: "corr-1",
    occurredAt: new Date().toISOString(),
    globalPersonId: GLOBAL_PERSON_ID,
    payload: {
      cpEmploymentId: CP_EMPLOYMENT_ID,
      financeEmployeeId: FIN_EMPLOYEE_ID,
      satelliteKey: "industry_clinic",
      satelliteRole: "DOCTOR",
      staffCode: "FINEMP1",
      fullName: "Dr Test",
      login: "dr-test",
      pin: "1234",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.role.findFirst.mockResolvedValue({ id: "role-1", code: "DOCTOR" });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "user-1" });
    prisma.practitioner.upsert.mockResolvedValue({ id: "pr-1" });
  });

  it("upserts practitioner by cpEmploymentId and returns satelliteUserId", async () => {
    const result = await handleStaffProvisionEvent(provisionEvent);
    expect(result).toEqual({ satelliteUserId: "user-1" });
    const { prisma } = jest.requireMock("@/lib/prisma");
    expect(prisma.practitioner.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cpEmploymentId: CP_EMPLOYMENT_ID },
        create: expect.objectContaining({
          cpEmploymentId: CP_EMPLOYMENT_ID,
          financeEmployeeId: FIN_EMPLOYEE_ID,
          userId: "user-1",
        }),
      }),
    );
  });

  it("deactivates user and practitioner on deactivate event", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    await handleStaffProvisionEvent({
      type: "STAFF_DEACTIVATED",
      organizationId: ORG_ID,
      correlationId: "corr-2",
      occurredAt: new Date().toISOString(),
      payload: {
        cpEmploymentId: CP_EMPLOYMENT_ID,
        financeEmployeeId: FIN_EMPLOYEE_ID,
        satelliteKey: "industry_clinic",
        staffCode: "FINEMP1",
        satelliteUserId: "user-1",
      },
    });
    expect(prisma.user.updateMany).toHaveBeenCalled();
    expect(prisma.practitioner.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cpEmploymentId: CP_EMPLOYMENT_ID },
        data: { active: false },
      }),
    );
  });
});
