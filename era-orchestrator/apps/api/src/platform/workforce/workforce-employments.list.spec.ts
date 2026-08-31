import { RoleBindingStatus } from "@era365/database";
import { WorkforceEmploymentsService } from "./workforce-employments.service";

describe("WorkforceEmploymentsService.list include", () => {
  const prisma = {
    workforceEmployment: { findMany: jest.fn(), findFirst: jest.fn() },
  };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const svc = new WorkforceEmploymentsService(
    prisma as never,
    {} as never,
    entitlement as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    entitlement.assertWorkforceHub.mockResolvedValue(undefined);
    prisma.workforceEmployment.findMany.mockResolvedValue([]);
    prisma.workforceEmployment.findFirst.mockResolvedValue({
      id: "emp-1",
      globalPersonId: "p1",
    });
  });

  it("includes active roleBindings so workspace overflow can show Reprovision", async () => {
    await svc.list("org-1");
    expect(prisma.workforceEmployment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          roleBindings: {
            where: { status: RoleBindingStatus.ACTIVE },
            select: { satelliteKey: true, satelliteRole: true },
          },
        }),
      }),
    );
  });

  it("includes the same bindings on employment detail", async () => {
    await svc.getOne("org-1", "emp-1");
    expect(prisma.workforceEmployment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          roleBindings: {
            where: { status: RoleBindingStatus.ACTIVE },
            select: { satelliteKey: true, satelliteRole: true },
          },
        }),
      }),
    );
  });
});
