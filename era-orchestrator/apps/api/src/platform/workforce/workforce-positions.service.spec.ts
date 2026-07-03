import { BadRequestException } from "@nestjs/common";
import { WorkforcePositionsService } from "./workforce-positions.service";

describe("WorkforcePositionsService", () => {
  const prisma = {
    workforcePosition: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    orgUnit: { findFirst: jest.fn() },
    workforceEmployment: { count: jest.fn() },
  };
  const scope = {
    resolveScopeForCommercialOrg: jest.fn().mockResolvedValue({
      workforceScopeId: "scope1",
      workforceScope: { id: "scope1", anchorOrganizationId: "org1" },
    }),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const satelliteEvents = { enqueue: jest.fn().mockResolvedValue({ jobId: "j1" }) };

  const svc = new WorkforcePositionsService(
    prisma as never,
    scope as never,
    audit as never,
    satelliteEvents as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("assertSlotAvailable throws POSITION_SLOTS_FULL when full", async () => {
    prisma.workforcePosition.findUnique.mockResolvedValue({
      id: "p1",
      status: "ACTIVE",
      totalSlots: 2,
    });
    prisma.workforceEmployment.count.mockResolvedValue(2);

    await expect(svc.assertSlotAvailable("p1")).rejects.toMatchObject({
      response: { code: "POSITION_SLOTS_FULL" },
    });
  });

  it("rejects totalSlots below active employments on update", async () => {
    prisma.workforcePosition.findFirst.mockResolvedValue({
      id: "p1",
      totalSlots: 3,
      orgUnit: { workforceScopeId: "scope1" },
    });
    prisma.workforceEmployment.count.mockResolvedValue(2);

    await expect(
      svc.update("org1", "p1", "u1", { totalSlots: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
