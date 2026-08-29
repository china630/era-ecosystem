import { OrgUnitStatus } from "@era365/database";
import { WorkforceImportService } from "./workforce-import.service";

const ORG = "44444444-4444-4444-8444-444444444444";
const UNIT_HS = "unit-hs";
const POS_CLEAN = "pos-clean";

describe("WorkforceImportService.importOrgStructure", () => {
  const prisma = {
    orgUnit: { findMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
    workforcePosition: { findMany: jest.fn() },
  };
  const mdm = {};
  const entitlement = { assertWorkforceHub: jest.fn() };
  const scope = { resolveScopeForCommercialOrg: jest.fn() };
  const provision = {};
  const absences = {};
  const orgUnits = { create: jest.fn(), archive: jest.fn() };
  const positions = { create: jest.fn(), update: jest.fn() };

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
    prisma.orgUnit.findMany.mockResolvedValue([]);
    prisma.workforcePosition.findMany.mockResolvedValue([]);
    orgUnits.create.mockImplementation(async (_o: string, _a: string, dto: { name: string }) => ({
      id: "unit-new",
      name: dto.name,
      status: OrgUnitStatus.ACTIVE,
    }));
    positions.create.mockImplementation(
      async (_o: string, _a: string, dto: { orgUnitId: string; name: string; totalSlots: number }) => ({
        id: "pos-new",
        orgUnitId: dto.orgUnitId,
        name: dto.name,
        totalSlots: dto.totalSlots,
      }),
    );
    positions.update.mockResolvedValue({ id: POS_CLEAN, totalSlots: 3 });
  });

  it("creates unit + position on first apply", async () => {
    const csv = "orgUnit,position,totalSlots\nHousekeeping,Cleaner,2\n";
    const result = await svc.importOrgStructure(ORG, "actor1", csv, false);
    expect(orgUnits.create).toHaveBeenCalledWith(
      ORG,
      "actor1",
      expect.objectContaining({ name: "Housekeeping" }),
    );
    expect(positions.create).toHaveBeenCalledWith(
      ORG,
      "actor1",
      expect.objectContaining({
        orgUnitId: "unit-new",
        name: "Cleaner",
        totalSlots: 2,
      }),
    );
    expect(orgUnits.archive).not.toHaveBeenCalled();
    expect(prisma.orgUnit.delete).not.toHaveBeenCalled();
    expect(result.created).toBe(1);
    expect(result.errors).toBe(0);
  });

  it("skips an identical repeat and updates slots when they change", async () => {
    prisma.orgUnit.findMany.mockResolvedValue([
      { id: UNIT_HS, name: "Housekeeping", status: OrgUnitStatus.ACTIVE },
    ]);
    prisma.workforcePosition.findMany.mockResolvedValue([
      { id: POS_CLEAN, orgUnitId: UNIT_HS, name: "Cleaner", totalSlots: 2 },
    ]);
    const same = "orgUnit,position,totalSlots\nHousekeeping,Cleaner,2\n";
    const skip = await svc.importOrgStructure(ORG, "actor1", same, false);
    expect(orgUnits.create).not.toHaveBeenCalled();
    expect(positions.create).not.toHaveBeenCalled();
    expect(positions.update).not.toHaveBeenCalled();
    expect(skip.skipped).toBe(1);
    expect(skip.created).toBe(0);

    const bumped = "orgUnit,position,totalSlots\nHousekeeping,Cleaner,3\n";
    const updated = await svc.importOrgStructure(ORG, "actor1", bumped, false);
    expect(positions.update).toHaveBeenCalledWith(
      ORG,
      POS_CLEAN,
      "actor1",
      expect.objectContaining({ totalSlots: 3 }),
    );
    expect(updated.skipped).toBe(1);
    expect(prisma.orgUnit.delete).not.toHaveBeenCalled();
  });

  it("accepts AZ headers and reactivates an archived unit", async () => {
    prisma.orgUnit.findMany.mockResolvedValue([
      { id: UNIT_HS, name: "Resepşn", status: "ARCHIVED" },
    ]);
    prisma.workforcePosition.findMany.mockResolvedValue([]);
    prisma.orgUnit.update.mockResolvedValue({
      id: UNIT_HS,
      name: "Resepşn",
      status: OrgUnitStatus.ACTIVE,
    });
    const csv = "Şöbə,Vəzifə,Ştat vahidi\nResepşn,Qeydiyyatçı,2\n";
    const result = await svc.importOrgStructure(ORG, "actor1", csv, false);
    expect(prisma.orgUnit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: UNIT_HS },
        data: { status: OrgUnitStatus.ACTIVE },
      }),
    );
    expect(positions.create).toHaveBeenCalledWith(
      ORG,
      "actor1",
      expect.objectContaining({ orgUnitId: UNIT_HS, name: "Qeydiyyatçı", totalSlots: 2 }),
    );
    expect(result.created).toBe(1);
  });
});
