import { BadRequestException } from "@nestjs/common";
import { WorkforceEmploymentsService } from "./workforce-employments.service";

describe("WorkforceEmploymentsService.updateReporting", () => {
  const prisma = {
    workforceEmployment: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const entitlement = {
    assertWorkforceHub: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  const svc = new WorkforceEmploymentsService(
    prisma as never,
    {} as never,
    entitlement as never,
    audit as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("rejects self as line manager", async () => {
    prisma.workforceEmployment.findFirst.mockResolvedValue({
      id: "e1",
      organizationId: "org1",
      status: "ACTIVE",
      orgUnit: {},
      position: {},
      roleBindings: [],
    });

    await expect(
      svc.updateReporting("org1", "e1", "actor", {
        managerEmploymentId: "e1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
