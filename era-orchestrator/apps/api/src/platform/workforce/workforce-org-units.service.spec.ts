import { BadRequestException } from "@nestjs/common";
import { WorkforceOrgUnitsService } from "./workforce-org-units.service";

describe("WorkforceOrgUnitsService", () => {
  const prisma = {
    orgUnit: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
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

  const svc = new WorkforceOrgUnitsService(
    prisma as never,
    {} as never,
    scope as never,
    audit as never,
    satelliteEvents as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("rejects move that would create a cycle", async () => {
    prisma.orgUnit.findFirst.mockResolvedValue({
      id: "child",
      parentId: "parent",
      workforceScopeId: "scope1",
      name: "Child",
      code: null,
      managerEmploymentId: null,
    });
    prisma.orgUnit.findUnique
      .mockResolvedValueOnce({ parentId: "child" })
      .mockResolvedValueOnce({ parentId: null });

    await expect(
      svc.update("org1", "child", "u1", { parentId: "grandchild" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects archive when active employments exist", async () => {
    prisma.orgUnit.findFirst.mockResolvedValue({
      id: "u1",
      parentId: null,
      workforceScopeId: "scope1",
      name: "Unit",
      code: null,
      managerEmploymentId: null,
    });
    prisma.workforceEmployment.count.mockResolvedValue(2);

    await expect(svc.archive("org1", "u1", "u1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("collectSubtreeIds returns node and descendants", async () => {
    prisma.orgUnit.findMany.mockResolvedValue([
      { id: "root", parentId: null },
      { id: "a", parentId: "root" },
      { id: "b", parentId: "a" },
      { id: "other", parentId: null },
    ]);
    const ids = await svc.collectSubtreeIds("root");
    expect(ids.sort()).toEqual(["a", "b", "root"].sort());
  });
});
