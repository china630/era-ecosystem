import { EmployeeEmploymentStatus } from "@erafinance/database";
import { WorkforceEmploymentSyncService } from "./workforce-employment-sync.service";
import { WorkforceMirrorMissingError } from "./workforce-mirror-missing.error";

describe("WorkforceEmploymentSyncService", () => {
  const orgA = "660e8400-e29b-41d4-a716-446655440001";
  const orgB = "660e8400-e29b-41d4-a716-446655440002";
  const personId = "770e8400-e29b-41d4-a716-446655440010";
  const empA = "880e8400-e29b-41d4-a716-4466554400a1";
  const empB = "880e8400-e29b-41d4-a716-4466554400b1";
  const positionCp = "990e8400-e29b-41d4-a716-446655440031";

  const mdmWithFin = {
    complianceIdentity: jest.fn().mockResolvedValue({ fin: "ABC1234" }),
  };
  const mdmNoFin = {
    complianceIdentity: jest.fn().mockResolvedValue({ fin: null }),
  };

  function makeSvc(opts: {
    prisma?: unknown;
    hasHrFull?: boolean;
    emas?: unknown;
    mdm?: unknown;
    controlPlane?: unknown;
    orgEnsure?: unknown;
  }) {
    return new WorkforceEmploymentSyncService(
      (opts.prisma ?? {}) as never,
      {
        hasModule: jest.fn().mockResolvedValue(opts.hasHrFull ?? true),
      } as never,
      (opts.orgEnsure ?? {
        ensureOrganization: jest.fn().mockResolvedValue(undefined),
      }) as never,
      (opts.controlPlane ?? {
        forward: jest.fn().mockResolvedValue({ ok: true }),
      }) as never,
      (opts.emas ?? {
        enqueueManualLifecycle: jest.fn().mockResolvedValue({ enqueued: false }),
      }) as never,
      (opts.mdm ?? mdmWithFin) as never,
    );
  }

  function hiredEvent(organizationId: string, cpEmploymentId: string) {
    return {
      type: "WORKFORCE_EMPLOYMENT_HIRED",
      organizationId,
      correlationId: `${cpEmploymentId}:HIRED:1`,
      occurredAt: "2026-09-01T10:00:00.000Z",
      globalPersonId: personId,
      payload: {
        cpEmploymentId,
        organizationId,
        globalPersonId: personId,
        orgUnitId: "aa0e8400-e29b-41d4-a716-446655440001",
        positionId: positionCp,
        hireDate: "2026-09-01",
        fullName: "Test Person",
      },
    };
  }

  function terminatedEvent(organizationId: string, cpEmploymentId: string) {
    return {
      type: "WORKFORCE_EMPLOYMENT_TERMINATED",
      organizationId,
      correlationId: `${cpEmploymentId}:TERMINATED:1`,
      occurredAt: "2026-09-15T12:00:00.000Z",
      globalPersonId: personId,
      payload: {
        cpEmploymentId,
        organizationId,
        globalPersonId: personId,
      },
    };
  }

  it("creates Employee on HIRED and writes back financeEmployeeId", async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "fin-emp-1" }),
      },
      jobPosition: {
        findFirst: jest.fn().mockResolvedValue({ id: "pos-1" }),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({ settings: { hr: { emasMode: "OFF" } } }),
      },
    };
    const controlPlane = { forward: jest.fn().mockResolvedValue({ ok: true }) };
    const orgEnsure = { ensureOrganization: jest.fn().mockResolvedValue(undefined) };
    const svc = makeSvc({ prisma, controlPlane, orgEnsure });

    const result = await svc.handleHired(orgA, hiredEvent(orgA, empA));

    expect(orgEnsure.ensureOrganization).toHaveBeenCalledWith(orgA);
    expect(prisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emasEligible: true }),
      }),
    );
    expect(controlPlane.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PATCH",
        path: `/internal/v1/workforce/employments/${empA}/finance-link`,
        body: { financeEmployeeId: "fin-emp-1" },
      }),
    );
    expect(result.meta).toEqual({
      employeeId: "fin-emp-1",
      cpEmploymentId: empA,
      emasEligible: true,
    });
  });

  it("sets emasEligible false when MDM has no FIN (SELECTIVE-safe)", async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "fin-emp-2" }),
      },
      jobPosition: { findFirst: jest.fn().mockResolvedValue({ id: "pos-1" }) },
      organization: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ settings: { hr: { emasMode: "SELECTIVE" } } }),
      },
    };
    const emas = {
      enqueueManualLifecycle: jest.fn().mockResolvedValue({ enqueued: false }),
    };
    const svc = makeSvc({ prisma, emas, mdm: mdmNoFin });
    const result = await svc.handleHired(orgA, hiredEvent(orgA, empA));
    expect(prisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emasEligible: false }),
      }),
    );
    expect(result.meta?.emasEligible).toBe(false);
  });

  it("FULL mode without FIN returns emasFinWarning", async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "fin-emp-3" }),
      },
      jobPosition: { findFirst: jest.fn().mockResolvedValue({ id: "pos-1" }) },
      organization: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ settings: { hr: { emasMode: "FULL" } } }),
      },
    };
    const svc = makeSvc({ prisma, mdm: mdmNoFin });
    const result = await svc.handleHired(orgA, hiredEvent(orgA, empA));
    expect(result.meta?.emasFinWarning).toBe(true);
  });

  it("hires same globalPersonId into two orgs independently", async () => {
    const created: string[] = [];
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => {
          const id = `fin-${data.organizationId.slice(-1)}`;
          created.push(data.organizationId);
          return Promise.resolve({ id });
        }),
      },
      jobPosition: {
        findFirst: jest.fn().mockResolvedValue({ id: "pos-1" }),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({ settings: {} }),
      },
    };
    const controlPlane = { forward: jest.fn().mockResolvedValue({ ok: true }) };
    const svc = makeSvc({ prisma, controlPlane });

    await svc.handleHired(orgA, hiredEvent(orgA, empA));
    await svc.handleHired(orgB, hiredEvent(orgB, empB));

    expect(created).toEqual([orgA, orgB]);
    expect(controlPlane.forward).toHaveBeenCalledTimes(2);
  });

  it("skips HIRED when org lacks hr_full", async () => {
    const svc = makeSvc({ hasHrFull: false });
    const result = await svc.handleHired(orgA, hiredEvent(orgA, empA));
    expect(result.meta).toEqual({ skipped: true, reason: "no_hr_full" });
  });

  it("idempotent HIRED when Employee already exists", async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({ id: "fin-emp-1" }),
        create: jest.fn(),
      },
      jobPosition: { findFirst: jest.fn() },
    };
    const controlPlane = { forward: jest.fn().mockResolvedValue({ ok: true }) };
    const svc = makeSvc({ prisma, controlPlane });
    const result = await svc.handleHired(orgA, hiredEvent(orgA, empA));
    expect(prisma.employee.create).not.toHaveBeenCalled();
    expect(controlPlane.forward).toHaveBeenCalled();
    expect(result.meta?.reason).toBe("exists");
  });

  it("throws WorkforceMirrorMissingError when position mirror missing", async () => {
    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      jobPosition: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const svc = makeSvc({ prisma });
    await expect(svc.handleHired(orgA, hiredEvent(orgA, empA))).rejects.toBeInstanceOf(
      WorkforceMirrorMissingError,
    );
  });

  it("terminates only the matching org Employee (leaves other org untouched)", async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: "fin-a",
          employmentStatus: EmployeeEmploymentStatus.ACTIVE,
        }),
        update,
      },
    };
    const svc = makeSvc({ prisma });

    const result = await svc.handleTerminated(orgA, terminatedEvent(orgA, empA));

    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: orgA,
        cpEmploymentId: empA,
        deletedAt: null,
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "fin-a" },
      data: {
        employmentStatus: EmployeeEmploymentStatus.TERMINATED,
        contractEndDate: new Date("2026-09-15T00:00:00.000Z"),
      },
    });
    expect(result.meta?.employeeId).toBe("fin-a");
  });

  it("TERMINATED is idempotent when already terminated", async () => {
    const update = jest.fn();
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: "fin-a",
          employmentStatus: EmployeeEmploymentStatus.TERMINATED,
        }),
        update,
      },
    };
    const svc = makeSvc({ prisma });
    const result = await svc.handleTerminated(orgA, terminatedEvent(orgA, empA));
    expect(update).not.toHaveBeenCalled();
    expect(result.meta?.reason).toBe("already_terminated");
  });

  it("TERMINATED unknown employment does not throw", async () => {
    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    };
    const svc = makeSvc({ prisma });
    const result = await svc.handleTerminated(orgA, terminatedEvent(orgA, empA));
    expect(result.meta).toEqual({ skipped: true, reason: "employee_not_found" });
  });

  it("skips TERMINATED when org lacks hr_full", async () => {
    const svc = makeSvc({ hasHrFull: false });
    const result = await svc.handleTerminated(orgA, terminatedEvent(orgA, empA));
    expect(result.meta).toEqual({ skipped: true, reason: "no_hr_full" });
  });
});
