import {
  WorkforceAbsenceKind,
  WorkforceAbsenceStatus,
  WorkforceEmploymentStatus,
  WorkforcePersonnelOrderStatus,
  WorkforcePersonnelOrderType,
} from "@era365/database";
import { WorkforceMigrationService } from "./workforce-migration.service";

const ORG = "44444444-4444-4444-8444-444444444444";
const ACTOR = "aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa";
const EMP = "bbbbbbbb-bbbb-bbbb-8bbb-bbbbbbbbbbbb";
const SCOPE = "scope-1";

function makeService() {
  const prisma = {
    workforceMigrationStep: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({}),
    },
    orgUnit: { findMany: jest.fn().mockResolvedValue([]) },
    workforcePosition: { findMany: jest.fn().mockResolvedValue([]) },
    workforceEmployment: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    workforcePlace: { findMany: jest.fn().mockResolvedValue([]) },
    workforceBrigade: { findMany: jest.fn().mockResolvedValue([]) },
    workforceShiftCycle: { findMany: jest.fn().mockResolvedValue([]) },
    workforceShiftAssignment: { findFirst: jest.fn() },
    workforceAbsence: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    workforcePersonnelOrder: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const mdm = {
    findPersonIdByFin: jest.fn(),
    workforceResolvePerson: jest.fn(),
  };
  const entitlement = { assertWorkforceHub: jest.fn().mockResolvedValue(undefined) };
  const scope = {
    resolveScopeForCommercialOrg: jest.fn().mockResolvedValue({
      workforceScopeId: SCOPE,
    }),
  };
  const provision = { hire: jest.fn() };
  const roster = {
    createPlace: jest.fn(),
    createBrigade: jest.fn(),
    transferBrigadeMembers: jest.fn(),
    createAssignment: jest.fn(),
  };
  const finance = { applyEmploymentOpening: jest.fn() };
  const importService = { importOrgStructure: jest.fn() };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  const svc = new WorkforceMigrationService(
    prisma as never,
    mdm as never,
    entitlement as never,
    scope as never,
    provision as never,
    roster as never,
    finance as never,
    importService as never,
    audit as never,
  );
  return { svc, prisma, mdm, provision, roster, finance, importService, audit };
}

describe("WorkforceMigrationService", () => {
  it("people: importReady=no and 5-char FIN do not hire", async () => {
    const { svc, provision, mdm, prisma } = makeService();
    prisma.orgUnit.findMany.mockResolvedValue([{ id: "u1", name: "Ops", code: "OPS" }]);
    prisma.workforcePosition.findMany.mockResolvedValue([
      { id: "p1", orgUnitId: "u1", name: "Guard" },
    ]);
    const csv =
      "fin,firstName,lastName,orgUnit,position,hireDate,importReady\n" +
      "1A2B3C4,Ali,Mammadov,Ops,Guard,2024-01-15,no\n" +
      "AB12C,John,Doe,Ops,Guard,2024-01-15,yes\n";
    const result = await svc.apply(ORG, ACTOR, "people", csv);
    expect(provision.hire).not.toHaveBeenCalled();
    expect(mdm.workforceResolvePerson).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.rows.some((r) => r.message.includes("review queue"))).toBe(true);
    expect(result.created).toBe(0);
  });

  it("leave: APPROVED + source=import; second apply does not insert; COMPENSATION is skip", async () => {
    const { svc, prisma, mdm } = makeService();
    mdm.findPersonIdByFin.mockResolvedValue("person-1");
    prisma.workforceEmployment.findFirst.mockResolvedValue({
      id: EMP,
      hireDate: new Date("2020-01-01T00:00:00.000Z"),
      financeEmployeeId: "fin-emp",
    });
    prisma.workforceAbsence.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "abs-1" });
    prisma.workforceAbsence.create.mockResolvedValue({ id: "abs-1" });
    prisma.workforcePersonnelOrder.findFirst.mockResolvedValue(null);
    prisma.workforcePersonnelOrder.create.mockResolvedValue({ id: "ord-1" });

    const csv =
      "fin,kind,startDate,endDate,orderNo,employmentStatus\n" +
      "1A2B3C4,VACATION,2025-07-01,2025-07-14,Q-12,ACTIVE\n" +
      "1A2B3C4,COMPENSATION,2025-08-01,2025-08-01,Q-13,ACTIVE\n";
    const first = await svc.apply(ORG, ACTOR, "leave-history", csv);
    expect(first.created).toBe(1);
    expect(first.skipped).toBe(1);
    expect(prisma.workforceAbsence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WorkforceAbsenceStatus.APPROVED,
          kind: WorkforceAbsenceKind.VACATION,
          source: "import",
          sourceRef: "1A2B3C4|Q-12|2025-07-01|2025-07-14",
        }),
      }),
    );
    expect(prisma.workforcePersonnelOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: WorkforcePersonnelOrderType.LEAVE_ANNUAL,
          status: WorkforcePersonnelOrderStatus.ISSUED,
          sequenceYear: null,
          sequenceSeq: null,
          source: "import",
        }),
      }),
    );

    prisma.workforceAbsence.create.mockClear();
    prisma.workforcePersonnelOrder.create.mockClear();
    prisma.workforceAbsence.findFirst.mockResolvedValue({ id: "abs-1" });
    prisma.workforcePersonnelOrder.findFirst.mockResolvedValue({
      id: "ord-1",
      employmentId: EMP,
      orderNumber: "Q-12",
    });
    const second = await svc.apply(ORG, ACTOR, "leave-history", csv);
    expect(prisma.workforceAbsence.create).not.toHaveBeenCalled();
    expect(prisma.workforcePersonnelOrder.create).not.toHaveBeenCalled();
    expect(prisma.workforceAbsence.update).toHaveBeenCalled();
    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);
  });

  it("leave: start after end is an error", async () => {
    const { svc, prisma, mdm } = makeService();
    mdm.findPersonIdByFin.mockResolvedValue("person-1");
    prisma.workforceEmployment.findFirst.mockResolvedValue({
      id: EMP,
      hireDate: new Date("2020-01-01T00:00:00.000Z"),
      financeEmployeeId: "fin-emp",
    });
    const result = await svc.apply(
      ORG,
      ACTOR,
      "leave-history",
      "fin,kind,startDate,endDate,orderNo\n1A2B3C4,VACATION,2025-08-14,2025-08-01,Q-9\n",
    );
    expect(result.errors).toBe(1);
    expect(result.created).toBe(0);
    expect(prisma.workforceAbsence.create).not.toHaveBeenCalled();
    expect(prisma.workforceMigrationStep.upsert).not.toHaveBeenCalled();
  });

  it("apply with only errors does not mark the step applied", async () => {
    const { svc, prisma, mdm } = makeService();
    mdm.findPersonIdByFin.mockResolvedValue(null);
    const result = await svc.apply(
      ORG,
      ACTOR,
      "salary",
      "fin,salary\n1A2B3C4,400\n",
    );
    expect(result.errors).toBe(1);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(prisma.workforceMigrationStep.upsert).not.toHaveBeenCalled();
  });

  it("leave does not publish Finance events (no absences.create)", async () => {
    const { svc, prisma, mdm } = makeService();
    mdm.findPersonIdByFin.mockResolvedValue("person-1");
    prisma.workforceEmployment.findFirst.mockResolvedValue({
      id: EMP,
      hireDate: new Date("2020-01-01T00:00:00.000Z"),
      financeEmployeeId: "fin-emp",
    });
    prisma.workforceAbsence.findFirst.mockResolvedValue(null);
    prisma.workforceAbsence.create.mockResolvedValue({ id: "abs-1" });
    prisma.workforcePersonnelOrder.findFirst.mockResolvedValue(null);
    prisma.workforcePersonnelOrder.create.mockResolvedValue({ id: "ord-1" });
    await svc.apply(
      ORG,
      ACTOR,
      "leave-history",
      "fin,kind,startDate,endDate,orderNo\n1A2B3C4,VACATION,2025-07-01,2025-07-14,Q-1\n",
    );
    expect(prisma.workforceAbsence.create).toHaveBeenCalled();
    expect(
      (prisma.workforceAbsence.create.mock.calls[0][0].data as { status: string }).status,
    ).toBe("APPROVED");
  });

  it("skip writes skipped; step 1 skip is 400", async () => {
    const { svc, prisma, audit } = makeService();
    await expect(svc.skip(ORG, ACTOR, "org-structure")).rejects.toThrow(
      /cannot be skipped/,
    );
    const out = await svc.skip(ORG, ACTOR, "year-grid");
    expect(out.status).toBe("skipped");
    expect(prisma.workforceMigrationStep.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ stepId: "year-grid", status: "skipped" }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ outcome: "skipped", stepId: "year-grid" }),
      }),
    );
  });

  it("year-grid preview/apply is 400 no write", async () => {
    const { svc } = makeService();
    await expect(svc.preview(ORG, ACTOR, "year-grid", "")).rejects.toThrow(/no write/);
    await expect(svc.apply(ORG, ACTOR, "year-grid", "")).rejects.toThrow(/no write/);
  });

  it("brigade with past hire date opens membership via transfer", async () => {
    const { svc, prisma, mdm, roster } = makeService();
    mdm.findPersonIdByFin.mockResolvedValue("person-1");
    prisma.workforceEmployment.findFirst.mockResolvedValue({
      id: EMP,
      hireDate: new Date("2022-03-01T00:00:00.000Z"),
      financeEmployeeId: null,
    });
    prisma.workforceBrigade.findMany.mockResolvedValue([]);
    roster.createBrigade.mockResolvedValue({
      id: "br-1",
      code: "A QR",
      name: "A qr",
    });
    roster.transferBrigadeMembers.mockResolvedValue({
      movedCount: 1,
      skippedCount: 0,
    });
    const csv =
      "fin,brigade,hireDate,importReady,employmentStatus\n" +
      "1A2B3C4,A qr,2022-03-01,yes,ACTIVE\n";
    const result = await svc.apply(ORG, ACTOR, "brigades", csv);
    expect(roster.createBrigade).toHaveBeenCalledWith(
      ORG,
      ACTOR,
      expect.objectContaining({ code: "A QR", effectiveFrom: "2022-03-01" }),
    );
    expect(roster.transferBrigadeMembers).toHaveBeenCalledWith(
      ORG,
      ACTOR,
      expect.objectContaining({
        employmentIds: [EMP],
        effectiveFrom: "2022-03-01",
      }),
    );
    expect(result.created).toBe(1);
    expect(result.errors).toBe(0);
  });

  it("people hire uses empty satelliteKeys", async () => {
    const { svc, prisma, mdm, provision } = makeService();
    prisma.orgUnit.findMany.mockResolvedValue([{ id: "u1", name: "Ops", code: null }]);
    prisma.workforcePosition.findMany.mockResolvedValue([
      { id: "p1", orgUnitId: "u1", name: "Guard" },
    ]);
    mdm.workforceResolvePerson.mockResolvedValue({ globalPersonId: "person-1" });
    prisma.workforceEmployment.findFirst.mockResolvedValue(null);
    provision.hire.mockResolvedValue({ id: EMP });
    const csv =
      "fin,firstName,lastName,orgUnit,position,hireDate,importReady,employmentStatus\n" +
      "1A2B3C4,Ali,Mammadov,Ops,Guard,2024-01-15,yes,ACTIVE\n";
    const result = await svc.apply(ORG, ACTOR, "people", csv);
    expect(provision.hire).toHaveBeenCalledWith(
      ORG,
      ACTOR,
      expect.objectContaining({
        globalPersonId: "person-1",
        satelliteKeys: [],
      }),
    );
    expect(result.created).toBe(1);
  });

  it("existing ACTIVE employment updates hireDate as skipped", async () => {
    const { svc, prisma, mdm, provision } = makeService();
    prisma.orgUnit.findMany.mockResolvedValue([{ id: "u1", name: "Ops", code: null }]);
    prisma.workforcePosition.findMany.mockResolvedValue([
      { id: "p1", orgUnitId: "u1", name: "Guard" },
    ]);
    mdm.workforceResolvePerson.mockResolvedValue({ globalPersonId: "person-1" });
    prisma.workforceEmployment.findFirst.mockResolvedValue({
      id: EMP,
      hireDate: new Date("2020-01-01T00:00:00.000Z"),
      status: WorkforceEmploymentStatus.ACTIVE,
    });
    const csv =
      "fin,firstName,lastName,orgUnit,position,hireDate,importReady\n" +
      "1A2B3C4,Ali,Mammadov,Ops,Guard,2024-01-15,yes\n";
    const result = await svc.apply(ORG, ACTOR, "people", csv);
    expect(provision.hire).not.toHaveBeenCalled();
    expect(prisma.workforceEmployment.update).toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });
});
