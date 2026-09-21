import { RoleBindingStatus } from "@era365/database";
import { WorkforceEmploymentsService } from "./workforce-employments.service";

describe("WorkforceEmploymentsService.list include", () => {
  const prisma = {
    workforceEmployment: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
  };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const mdm = {
    findPersonIdByFin: jest.fn(),
    batchGetPersonOpsProfile: jest.fn(),
  };
  const svc = new WorkforceEmploymentsService(
    prisma as never,
    mdm as never,
    entitlement as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { ensureDraftForMutation: jest.fn(), listDraftBanners: jest.fn().mockResolvedValue({}) } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    entitlement.assertWorkforceHub.mockResolvedValue(undefined);
    prisma.workforceEmployment.findMany.mockResolvedValue([]);
    prisma.workforceEmployment.count.mockResolvedValue(0);
    prisma.workforceEmployment.findFirst.mockResolvedValue({
      id: "emp-1",
      globalPersonId: "p1",
    });
    mdm.findPersonIdByFin.mockResolvedValue(null);
    mdm.batchGetPersonOpsProfile.mockResolvedValue({});
  });

  it("includes active roleBindings so workspace overflow can show Reprovision", async () => {
    await svc.list("org-1");
    expect(prisma.workforceEmployment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          roleBindings: {
            where: { status: RoleBindingStatus.ACTIVE },
            select: {
              satelliteKey: true,
              satelliteRole: true,
              provisionState: true,
              lastProvisionError: true,
            },
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
            select: {
              satelliteKey: true,
              satelliteRole: true,
              provisionState: true,
              lastProvisionError: true,
            },
          },
        }),
      }),
    );
  });

  it("filters by FIN via MDM blind index then pages", async () => {
    prisma.workforceEmployment.findMany
      .mockResolvedValueOnce([
        { id: "e1", globalPersonId: "p-fin", hireDate: new Date(), createdAt: new Date() },
        { id: "e2", globalPersonId: "p-other", hireDate: new Date(), createdAt: new Date() },
      ])
      .mockResolvedValueOnce([{ id: "e1", globalPersonId: "p-fin" }]);
    mdm.findPersonIdByFin.mockResolvedValue("p-fin");

    const out = await svc.list("org-1", { q: "1A2B3C4", page: 1, pageSize: 50 });
    expect(mdm.findPersonIdByFin).toHaveBeenCalledWith("1A2B3C4");
    expect(out.total).toBe(1);
    expect(out.items).toHaveLength(1);
    expect(out.items[0].id).toBe("e1");
  });

  it("filters by name via MDM profiles (not UUID)", async () => {
    prisma.workforceEmployment.findMany
      .mockResolvedValueOnce([
        { id: "e1", globalPersonId: "p1", hireDate: new Date(), createdAt: new Date() },
        { id: "e2", globalPersonId: "p2", hireDate: new Date(), createdAt: new Date() },
      ])
      .mockResolvedValueOnce([{ id: "e2", globalPersonId: "p2" }]);
    mdm.batchGetPersonOpsProfile.mockResolvedValue({
      p1: { displayName: "Ali", firstName: "Ali", lastName: "Veli", middleName: null, sex: "MALE", birthDate: null },
      p2: {
        displayName: "Səxavət Əmirov",
        firstName: "Səxavət",
        lastName: "Əmirov",
        middleName: null,
        sex: "MALE",
        birthDate: null,
      },
    });

    const out = await svc.list("org-1", { q: "əmirov", page: 1, pageSize: 50 });
    expect(mdm.batchGetPersonOpsProfile).toHaveBeenCalled();
    expect(out.total).toBe(1);
    expect(out.items[0].id).toBe("e2");
  });
});
