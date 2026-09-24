import { BadRequestException, ConflictException, ValidationPipe } from "@nestjs/common";
import { addBakuDays, todayBakuYmd } from "@era/satellite-kit/time";
import { WorkforceEmploymentStatus } from "@era365/database";
import { UpdateWorkforceBrigadeDto } from "./dto/workforce-roster.dto";
import { WorkforceRosterService } from "./workforce-roster.service";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EMP = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const BRIGADE_A = "44444444-4444-4444-8444-444444444444";
const BRIGADE_D = "55555555-5555-4555-8555-555555555555";
const ACTOR = "33333333-3333-4333-8333-333333333333";

type MemberRow = {
  id: string;
  organizationId: string;
  brigadeId: string;
  employmentId: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  leftToBrigadeId: string | null;
  createdAt: Date;
};

function ymdDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function dateGte(a: Date | null, b: Date): boolean {
  return a != null && a.getTime() >= b.getTime();
}

function matchMember(row: MemberRow, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  if (where.organizationId && row.organizationId !== where.organizationId) return false;
  if (where.employmentId && row.employmentId !== where.employmentId) return false;
  if (where.brigadeId && row.brigadeId !== where.brigadeId) return false;
  if (where.effectiveTo === null && row.effectiveTo !== null) return false;
  const idNot = (where.id as { not?: string } | undefined)?.not;
  if (idNot && row.id === idNot) return false;
  const fromLte = (where.effectiveFrom as { lte?: Date } | undefined)?.lte;
  if (fromLte && row.effectiveFrom.getTime() > fromLte.getTime()) return false;
  if (Array.isArray(where.OR)) {
    const ok = (where.OR as Array<Record<string, unknown>>).some((clause) =>
      matchMember(row, clause),
    );
    if (!ok) return false;
  }
  const toGte = (where.effectiveTo as { gte?: Date } | undefined)?.gte;
  if (toGte && !dateGte(row.effectiveTo, toGte) && where.effectiveTo !== null) {
    if (!(where as { effectiveTo?: { gte?: Date } }).effectiveTo?.gte) {
      /* skip */
    } else if (row.effectiveTo == null || row.effectiveTo.getTime() < toGte.getTime()) {
      return false;
    }
  }
  return true;
}

describe("WorkforceRosterService brigade membership", () => {
  let members: MemberRow[];
  let seq: number;
  const prisma: any = {
    workforceBrigade: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    workforceBrigadeMember: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    workforceEmployment: { count: jest.fn(), findMany: jest.fn() },
    workforceTimesheet: { findMany: jest.fn() },
    workforceTimesheetEntry: { count: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const audit = { log: jest.fn() };
  const svc = new WorkforceRosterService(prisma, entitlement as never, audit as never);

  function seedOpen(brigadeId: string, fromYmd: string, employmentId = EMP) {
    members.push({
      id: `m-${++seq}`,
      organizationId: ORG,
      brigadeId,
      employmentId,
      effectiveFrom: ymdDate(fromYmd),
      effectiveTo: null,
      leftToBrigadeId: null,
      createdAt: new Date(),
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    members = [];
    seq = 0;
    entitlement.assertWorkforceHub.mockResolvedValue(undefined);
    audit.log.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation(
      async (arg: ((tx: typeof prisma) => Promise<unknown>) | Promise<unknown>[]) => {
        if (typeof arg === "function") return arg(prisma);
        return Promise.all(arg);
      },
    );
    prisma.workforceEmployment.count.mockImplementation(
      async (args: { where?: { status?: { not?: string } } }) => {
        if (args?.where?.status?.not === WorkforceEmploymentStatus.ACTIVE) return 0;
        return 1;
      },
    );
    prisma.workforceBrigade.findFirst.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        where.id === BRIGADE_A || where.id === BRIGADE_D
          ? { id: where.id, organizationId: ORG, code: "X", name: "Crew" }
          : null,
    );
    prisma.workforceTimesheet.findMany.mockResolvedValue([]);
    prisma.workforceTimesheetEntry.count.mockResolvedValue(0);
    prisma.workforceTimesheetEntry.findFirst.mockResolvedValue(null);
    prisma.workforceBrigadeMember.findMany.mockImplementation(
      async ({ where }: { where?: Record<string, unknown> }) =>
        members.filter((m) => matchMember(m, where)),
    );
    prisma.workforceBrigadeMember.findFirst.mockImplementation(
      async ({ where }: { where?: Record<string, unknown> }) =>
        members.find((m) => matchMember(m, where)) ?? null,
    );
    prisma.workforceBrigadeMember.create.mockImplementation(
      async ({ data }: { data: Omit<MemberRow, "id" | "createdAt"> }) => {
        const row: MemberRow = {
          ...data,
          id: `m-${++seq}`,
          createdAt: new Date(),
        };
        members.push(row);
        return row;
      },
    );
    prisma.workforceBrigadeMember.update.mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<MemberRow>;
      }) => {
        const row = members.find((m) => m.id === where.id);
        if (!row) throw new Error("missing");
        Object.assign(row, data);
        return row;
      },
    );
    prisma.workforceBrigadeMember.delete.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        members = members.filter((m) => m.id !== where.id);
        return { id: where.id };
      },
    );
  });

  it("transfers as of the 1st without rewriting the prior closed interval", async () => {
    seedOpen(BRIGADE_A, "2026-01-01");
    const result = await svc.transferBrigadeMembers(ORG, ACTOR, {
      employmentIds: [EMP],
      toBrigadeId: BRIGADE_D,
      fromBrigadeId: BRIGADE_A,
      effectiveFrom: "2026-10-01",
    });
    expect(result.movedCount).toBe(1);
    expect(result.effectiveFrom).toBe("2026-10-01");
    const closed = members.find((m) => m.brigadeId === BRIGADE_A);
    const opened = members.find((m) => m.brigadeId === BRIGADE_D);
    expect(closed?.effectiveTo?.toISOString().slice(0, 10)).toBe("2026-09-30");
    expect(opened?.effectiveFrom.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(opened?.effectiveTo).toBeNull();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ROSTER_BRIGADE_TRANSFER" }),
    );
  });

  it("rejects a second open membership", async () => {
    seedOpen(BRIGADE_A, "2026-01-01");
    seedOpen(BRIGADE_D, "2026-02-01", EMP);
    await expect(
      svc.transferBrigadeMembers(ORG, ACTOR, {
        employmentIds: [EMP],
        toBrigadeId: BRIGADE_D,
        effectiveFrom: todayBakuYmd(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects overlapping historical interval with 409", async () => {
    members.push({
      id: "hist",
      organizationId: ORG,
      brigadeId: BRIGADE_A,
      employmentId: EMP,
      effectiveFrom: ymdDate("2026-03-01"),
      effectiveTo: ymdDate("2026-03-15"),
      leftToBrigadeId: null,
      createdAt: new Date(),
    });
    await expect(
      svc.transferBrigadeMembers(ORG, ACTOR, {
        employmentIds: [EMP],
        toBrigadeId: BRIGADE_D,
        effectiveFrom: "2026-03-10",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a transfer on the open membership start day", async () => {
    seedOpen(BRIGADE_A, "2026-10-01");
    await expect(
      svc.transferBrigadeMembers(ORG, ACTOR, {
        employmentIds: [EMP],
        toBrigadeId: BRIGADE_D,
        effectiveFrom: "2026-10-01",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(members).toHaveLength(1);
    expect(members[0]?.effectiveTo).toBeNull();
    expect(members[0]?.brigadeId).toBe(BRIGADE_A);
  });

  it("rejects backdate when an APPROVED timesheet cell covers the day", async () => {
    seedOpen(BRIGADE_A, "2026-01-01");
    prisma.workforceTimesheetEntry.findFirst.mockResolvedValue({ id: "cell" });
    await expect(
      svc.transferBrigadeMembers(ORG, ACTOR, {
        employmentIds: [EMP],
        toBrigadeId: BRIGADE_D,
        effectiveFrom: "2026-03-10",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(members[0]?.brigadeId).toBe(BRIGADE_A);
    expect(members[0]?.effectiveTo).toBeNull();
  });

  it("rejects effectiveFrom beyond today+31 Baku days", async () => {
    seedOpen(BRIGADE_A, "2026-01-01");
    await expect(
      svc.transferBrigadeMembers(ORG, ACTOR, {
        employmentIds: [EMP],
        toBrigadeId: BRIGADE_D,
        effectiveFrom: addBakuDays(todayBakuYmd(), 32),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("PATCH body with employmentIds is rejected by ValidationPipe", async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    await expect(
      pipe.transform(
        { name: "Crew", employmentIds: [EMP] },
        { type: "body", metatype: UpdateWorkforceBrigadeDto },
      ),
    ).rejects.toBeTruthy();
  });

  it("leave closes the open interval the day before effectiveFrom", async () => {
    seedOpen(BRIGADE_A, "2026-01-01");
    const result = await svc.leaveBrigadeMembers(ORG, ACTOR, {
      employmentIds: [EMP],
      fromBrigadeId: BRIGADE_A,
      effectiveFrom: "2026-10-01",
    });
    expect(result.leftCount).toBe(1);
    expect(members[0]?.effectiveTo?.toISOString().slice(0, 10)).toBe("2026-09-30");
    expect(members[0]?.effectiveTo).not.toBeNull();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ROSTER_BRIGADE_LEAVE" }),
    );
  });

  it("no-op when already in the target brigade as-of the transfer day", async () => {
    seedOpen(BRIGADE_D, "2026-01-01");
    const result = await svc.transferBrigadeMembers(ORG, ACTOR, {
      employmentIds: [EMP],
      toBrigadeId: BRIGADE_D,
      effectiveFrom: todayBakuYmd(),
    });
    expect(result.movedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(members).toHaveLength(1);
  });

  it("join without an open row opens the target interval", async () => {
    const result = await svc.transferBrigadeMembers(ORG, ACTOR, {
      employmentIds: [EMP],
      toBrigadeId: BRIGADE_D,
      effectiveFrom: todayBakuYmd(),
    });
    expect(result.movedCount).toBe(1);
    expect(members).toHaveLength(1);
    expect(members[0]?.brigadeId).toBe(BRIGADE_D);
    expect(members[0]?.effectiveTo).toBeNull();
  });
});
