import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { WorkforceFitnessKind } from "@era365/database";
import { WorkforceFitnessService } from "./workforce-fitness.service";

describe("WorkforceFitnessService wave 13", () => {
  const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const EMP = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const OTHER_ORG = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  function makeSvc(prisma: any, quota?: any) {
    const entitlement = { assertWorkforceHub: jest.fn() };
    const audit = { log: jest.fn() };
    const q = quota ?? {
      assertStorageQuota: jest.fn(),
      addStorageUsage: jest.fn(),
    };
    const svc = new WorkforceFitnessService(
      prisma,
      entitlement as never,
      audit as never,
      q as never,
    );
    return { svc, entitlement, audit, quota: q };
  }

  it("empty requiredKinds does not block assignment", async () => {
    const prisma: any = {
      organization: {
        findFirst: jest.fn().mockResolvedValue({
          settings: { workforce: { fitness: { requiredKinds: [] } } },
        }),
      },
      workforceFitnessRecord: { findMany: jest.fn() },
    };
    const { svc } = makeSvc(prisma);
    await expect(
      svc.assertAssignable(ORG, EMP, "2026-09-30"),
    ).resolves.toBeUndefined();
    expect(prisma.workforceFitnessRecord.findMany).not.toHaveBeenCalled();
  });

  it("blocks place assignment when required HEALTH is MISSING", async () => {
    const prisma: any = {
      organization: {
        findFirst: jest.fn().mockResolvedValue({
          settings: {
            workforce: {
              fitness: {
                requiredKinds: ["HEALTH"],
                criminalRecordFreshnessDays: 90,
              },
            },
          },
        }),
      },
      workforceFitnessRecord: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const { svc } = makeSvc(prisma);
    await expect(
      svc.assertAssignable(ORG, EMP, "2026-09-30"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows assignment when HEALTH validUntil covers asOf", async () => {
    const prisma: any = {
      organization: {
        findFirst: jest.fn().mockResolvedValue({
          settings: {
            workforce: { fitness: { requiredKinds: ["HEALTH"] } },
          },
        }),
      },
      workforceFitnessRecord: {
        findMany: jest.fn().mockResolvedValue([
          {
            kind: WorkforceFitnessKind.HEALTH,
            issuedOn: new Date("2026-01-01T00:00:00.000Z"),
            validUntil: new Date("2026-12-31T00:00:00.000Z"),
          },
        ]),
      },
    };
    const { svc } = makeSvc(prisma);
    await expect(
      svc.assertAssignable(ORG, EMP, "2026-09-30"),
    ).resolves.toBeUndefined();
  });

  it("marks HEALTH EXPIRED when validUntil is before asOf", () => {
    const prisma: any = { organization: { findFirst: jest.fn() } };
    const { svc } = makeSvc(prisma);
    const status = svc.computeStatus(
      WorkforceFitnessKind.HEALTH,
      {
        issuedOn: new Date("2025-01-01T00:00:00.000Z"),
        validUntil: new Date("2026-01-01T00:00:00.000Z"),
      },
      { requiredKinds: [WorkforceFitnessKind.HEALTH], criminalRecordFreshnessDays: 90 },
      "2026-09-30",
    );
    expect(status).toBe("EXPIRED");
  });

  it("criminal-record freshness follows org days, not a hardcoded statute", () => {
    const prisma: any = { organization: { findFirst: jest.fn() } };
    const { svc } = makeSvc(prisma);
    const row = {
      issuedOn: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: null,
    };
    const short = svc.computeStatus(
      WorkforceFitnessKind.CRIMINAL_RECORD,
      row,
      {
        requiredKinds: [WorkforceFitnessKind.CRIMINAL_RECORD],
        criminalRecordFreshnessDays: 30,
      },
      "2026-02-15",
    );
    const long = svc.computeStatus(
      WorkforceFitnessKind.CRIMINAL_RECORD,
      row,
      {
        requiredKinds: [WorkforceFitnessKind.CRIMINAL_RECORD],
        criminalRecordFreshnessDays: 90,
      },
      "2026-02-15",
    );
    expect(short).toBe("EXPIRED");
    expect(long).toBe("PRESENT");
  });

  it("expired HEALTH rejects assignment", async () => {
    const prisma: any = {
      organization: {
        findFirst: jest.fn().mockResolvedValue({
          settings: {
            workforce: { fitness: { requiredKinds: ["HEALTH"] } },
          },
        }),
      },
      workforceFitnessRecord: {
        findMany: jest.fn().mockResolvedValue([
          {
            kind: WorkforceFitnessKind.HEALTH,
            issuedOn: new Date("2025-01-01T00:00:00.000Z"),
            validUntil: new Date("2026-01-01T00:00:00.000Z"),
          },
        ]),
      },
    };
    const { svc } = makeSvc(prisma);
    await expect(
      svc.assertAssignable(ORG, EMP, "2026-09-30"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("DAY_OFF does not require a fitness file", async () => {
    const { WorkforceRosterService } = await import(
      "./workforce-roster.service"
    );
    const { WorkforceDayOverrideKind } = await import("@era365/database");
    const fitness = {
      assertAssignable: jest.fn(),
      assertBrigadeAssignable: jest.fn(),
    };
    const prisma: any = {
      workforceEmployment: { count: jest.fn().mockResolvedValue(1) },
      workforceDayOverride: {
        upsert: jest.fn().mockResolvedValue({ id: "ov-1" }),
      },
    };
    const audit = { log: jest.fn() };
    const roster = new WorkforceRosterService(
      prisma,
      { assertWorkforceHub: jest.fn() } as never,
      audit as never,
      fitness as never,
    );
    await roster.upsertOverride(ORG, "hr-1", {
      employmentId: EMP,
      workDate: "2026-09-30",
      kind: WorkforceDayOverrideKind.DAY_OFF,
    });
    expect(fitness.assertAssignable).not.toHaveBeenCalled();
    expect(prisma.workforceDayOverride.upsert).toHaveBeenCalled();
  });

  it("rejected assignment does not delete punches", async () => {
    const { WorkforceRosterService } = await import(
      "./workforce-roster.service"
    );
    const fitness = {
      assertAssignable: jest.fn().mockRejectedValue(
        new BadRequestException({ code: "FITNESS_REQUIRED" }),
      ),
      assertBrigadeAssignable: jest.fn(),
    };
    const prisma: any = {
      workforceEmployment: { count: jest.fn().mockResolvedValue(1) },
      workforcePlace: { findFirst: jest.fn().mockResolvedValue({ id: "pl-1" }) },
      workforceShiftCycle: {
        findFirst: jest.fn().mockResolvedValue({ id: "cy-1" }),
      },
      workforceShiftAssignment: { create: jest.fn(), findMany: jest.fn() },
      workforceAttendancePunch: { deleteMany: jest.fn(), delete: jest.fn() },
    };
    const roster = new WorkforceRosterService(
      prisma,
      { assertWorkforceHub: jest.fn() } as never,
      { log: jest.fn() } as never,
      fitness as never,
    );
    await expect(
      roster.createAssignment(ORG, "hr-1", {
        employmentId: EMP,
        placeId: "pl-1",
        cycleId: "cy-1",
        effectiveFrom: "2026-09-30",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workforceShiftAssignment.create).not.toHaveBeenCalled();
    expect(prisma.workforceAttendancePunch.delete).not.toHaveBeenCalled();
    expect(prisma.workforceAttendancePunch.deleteMany).not.toHaveBeenCalled();
  });

  it("download refuses storage key from another organization", async () => {
    const prisma: any = {
      workforceFitnessRecord: {
        findFirst: jest.fn().mockResolvedValue({
          organizationId: ORG,
          employmentId: EMP,
          kind: WorkforceFitnessKind.HEALTH,
          storageKey: `org/${OTHER_ORG}/workforce-fitness/x.pdf`,
          contentType: "application/pdf",
          originalName: "x.pdf",
        }),
      },
    };
    const { svc } = makeSvc(prisma);
    await expect(
      svc.download(ORG, EMP, "HEALTH"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("export CSV headers do not include fitness columns", async () => {
    const { WorkforceExportService } = await import(
      "./workforce-export.service"
    );
    const prisma: any = {
      workforceEmployment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const entitlement = { assertWorkforceHub: jest.fn() };
    const mdm = {
      batchGetPersonOpsProfile: jest.fn().mockResolvedValue({}),
    };
    const svc = new WorkforceExportService(
      prisma,
      mdm as never,
      entitlement as never,
    );
    const csv = await svc.exportRosterCsv(ORG);
    expect(csv.toLowerCase()).not.toMatch(/fitness|health|narcology|criminal/);
  });
});
