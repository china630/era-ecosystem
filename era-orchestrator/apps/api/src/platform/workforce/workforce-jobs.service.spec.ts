import { BadRequestException } from "@nestjs/common";
import { WorkforceJobsService } from "./workforce-jobs.service";

describe("WorkforceJobsService", () => {
  const prisma = {
    workforceGrade: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    workforceJob: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    orgUnit: { findMany: jest.fn() },
    workforcePosition: { findMany: jest.fn() },
    workforceEmployment: { findMany: jest.fn() },
  };
  const scope = {
    resolveScopeForCommercialOrg: jest.fn().mockResolvedValue({
      workforceScopeId: "scope1",
    }),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new WorkforceJobsService(
    prisma as never,
    scope as never,
    audit as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("archiveGrade rejects when active jobs reference grade", async () => {
    prisma.workforceGrade.findFirst.mockResolvedValue({
      id: "g1",
      status: "ACTIVE",
      workforceScopeId: "scope1",
    });
    prisma.workforceJob.count.mockResolvedValue(2);

    await expect(svc.archiveGrade("org1", "g1", "actor")).rejects.toMatchObject({
      response: { code: "GRADE_IN_USE" },
    });
  });

  it("archiveGrade archives when unused", async () => {
    prisma.workforceGrade.findFirst.mockResolvedValue({
      id: "g1",
      status: "ACTIVE",
      workforceScopeId: "scope1",
    });
    prisma.workforceJob.count.mockResolvedValue(0);
    prisma.workforceGrade.update.mockResolvedValue({
      id: "g1",
      status: "ARCHIVED",
    });

    await expect(svc.archiveGrade("org1", "g1", "actor")).resolves.toMatchObject({
      status: "ARCHIVED",
    });
  });

  it("orgChart units mode returns parentId nodes", async () => {
    prisma.orgUnit.findMany.mockResolvedValue([
      {
        id: "u1",
        parentId: null,
        name: "HQ",
        unitKind: "COMPANY",
        managerEmploymentId: null,
      },
      {
        id: "u2",
        parentId: "u1",
        name: "Ops",
        unitKind: "DEPARTMENT",
        managerEmploymentId: "e1",
      },
    ]);

    const out = await svc.orgChart("org1", "units");
    expect(out.mode).toBe("units");
    expect(out.nodes).toHaveLength(2);
    expect(out.nodes[1]).toMatchObject({
      id: "u2",
      parentId: "u1",
      label: "Ops",
    });
  });
});
