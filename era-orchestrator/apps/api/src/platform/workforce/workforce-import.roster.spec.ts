import { WorkforceEmploymentStatus } from "@era365/database";
import { WorkforceImportService } from "./workforce-import.service";

const ORG = "44444444-4444-4444-8444-444444444444";
const PERSON = "person-1";
const UNIT_HS = "unit-hs";
const UNIT_KIT = "unit-kit";
const POS_CLEAN = "pos-clean";
const POS_COOK = "pos-cook";

const HEADER =
  "fin,fullName,sex,birthDate,orgUnit,position,hireDate,workplace,satellites";

describe("WorkforceImportService.importRoster", () => {
  const prisma = {
    orgUnit: { findMany: jest.fn() },
    workforcePosition: { findMany: jest.fn() },
    workforceEmployment: { findFirst: jest.fn(), update: jest.fn() },
  };
  const mdm = { workforceResolvePerson: jest.fn() };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const scope = { resolveScopeForCommercialOrg: jest.fn() };
  const provision = { hire: jest.fn() };
  const absences = {};
  const orgUnits = {};
  const positions = {};

  const svc = new WorkforceImportService(
    prisma as never,
    mdm as never,
    entitlement as never,
    scope as never,
    provision as never,
    absences as never,
    orgUnits as never,
    positions as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    entitlement.assertWorkforceHub.mockResolvedValue(undefined);
    scope.resolveScopeForCommercialOrg.mockResolvedValue({
      workforceScopeId: "scope1",
    });
    prisma.orgUnit.findMany.mockResolvedValue([
      { id: UNIT_HS, name: "Housekeeping", code: "HS", status: "ACTIVE" },
      { id: UNIT_KIT, name: "Kitchen", code: "KIT", status: "ACTIVE" },
    ]);
    prisma.workforcePosition.findMany.mockResolvedValue([
      { id: POS_CLEAN, name: "Cleaner", orgUnitId: UNIT_HS },
      { id: POS_COOK, name: "Cook", orgUnitId: UNIT_KIT },
    ]);
    mdm.workforceResolvePerson.mockResolvedValue({ globalPersonId: PERSON });
    provision.hire.mockResolvedValue({ employment: { id: "emp-new" }, bindings: [] });
    prisma.workforceEmployment.findFirst.mockResolvedValue(null);
  });

  it("resolves MDM even when the org unit is missing", async () => {
    const csv = `${HEADER}\n1A2B3C4,Ali Aliyev,MALE,1990-01-15,UnknownDept,Cleaner,2026-01-01,PRIMARY,`;
    const result = await svc.importRoster(ORG, "actor1", csv, false);
    expect(mdm.workforceResolvePerson).toHaveBeenCalledWith(
      expect.objectContaining({
        fin: "1A2B3C4",
        fullName: "Ali Aliyev",
        sex: "MALE",
        birthDate: "1990-01-15",
      }),
    );
    expect(provision.hire).not.toHaveBeenCalled();
    expect(result.errors).toBe(1);
    expect(result.rows[0].message).toMatch(/Org unit not found/);
  });

  it("skips hire for the same person+unit+position after MDM update", async () => {
    prisma.workforceEmployment.findFirst.mockResolvedValue({
      id: "emp-existing",
      hireDate: new Date("2026-01-01T00:00:00.000Z"),
    });
    const csv = `${HEADER}\n1A2B3C4,Ali Aliyev,MALE,1990-01-15,Housekeeping,Cleaner,2026-01-01,PRIMARY,`;
    const result = await svc.importRoster(ORG, "actor1", csv, false);
    expect(mdm.workforceResolvePerson).toHaveBeenCalled();
    expect(provision.hire).not.toHaveBeenCalled();
    expect(prisma.workforceEmployment.update).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.rows[0].message).toMatch(/MDM updated/);
    expect(prisma.workforceEmployment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          globalPersonId: PERSON,
          orgUnitId: UNIT_HS,
          positionId: POS_CLEAN,
          status: WorkforceEmploymentStatus.ACTIVE,
        }),
      }),
    );
  });

  it("updates hireDate on an existing employment when the roster date changed", async () => {
    prisma.workforceEmployment.findFirst.mockResolvedValue({
      id: "emp-existing",
      hireDate: new Date("2024-01-13T00:00:00.000Z"),
    });
    prisma.workforceEmployment.update.mockResolvedValue({ id: "emp-existing" });
    const csv = `${HEADER}\n1A2B3C4,Ali Aliyev,MALE,1990-01-15,Housekeeping,Cleaner,2026-05-12,PRIMARY,`;
    const result = await svc.importRoster(ORG, "actor1", csv, false);
    expect(provision.hire).not.toHaveBeenCalled();
    expect(prisma.workforceEmployment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "emp-existing" },
        data: { hireDate: new Date("2026-05-12T00:00:00.000Z") },
      }),
    );
    expect(result.skipped).toBe(1);
    expect(result.rows[0].message).toMatch(/hireDate 2024-01-13 → 2026-05-12/);
  });

  it("creates a second employment for the same FIN on another position", async () => {
    prisma.workforceEmployment.findFirst
      .mockResolvedValueOnce({
        id: "emp-existing",
        hireDate: new Date("2026-01-01T00:00:00.000Z"),
      })
      .mockResolvedValueOnce(null);
    const csv =
      `${HEADER}\n` +
      `1A2B3C4,Ali Aliyev,MALE,1990-01-15,Housekeeping,Cleaner,2026-01-01,PRIMARY,\n` +
      `1A2B3C4,Ali Aliyev,MALE,1990-01-15,Kitchen,Cook,2026-01-01,ADDITIONAL,industry_clinic`;
    const result = await svc.importRoster(ORG, "actor1", csv, false);
    expect(mdm.workforceResolvePerson).toHaveBeenCalledTimes(2);
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(1);
    expect(provision.hire).toHaveBeenCalledTimes(1);
    expect(provision.hire).toHaveBeenCalledWith(
      ORG,
      "actor1",
      expect.objectContaining({
        globalPersonId: PERSON,
        orgUnitId: UNIT_KIT,
        positionId: POS_COOK,
        satelliteKeys: [],
      }),
    );
  });
});
