import { readFileSync } from "node:fs";
import { join } from "node:path";
import { requireSeedOrgId } from "../prisma/seed-physio-catalog-lib";

const { loadIcd10, ICD10_VERSION } = require("../prisma/load-icd10.cjs") as {
  loadIcd10: (
    prisma: unknown,
    opts?: { force?: boolean },
  ) => Promise<{ skipped?: boolean; existing?: number }>;
  ICD10_VERSION: string;
};

describe("clinic satellite db:seed scripts", () => {
  it("db:seed is ICD + templates only; kitchen sink is db:seed:demo", () => {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "..", "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const seed = pkg.scripts["db:seed"] ?? "";
    const demo = pkg.scripts["db:seed:demo"] ?? "";
    expect(seed).toContain("load-icd10.cjs");
    expect(seed).toContain("seed-physio-catalog-base");
    expect(seed).toContain("seed-diagnostic-catalog-base");
    expect(seed).not.toContain("seed-vnext");
    expect(seed).not.toContain("load-nafta-prices");
    expect(seed).not.toContain("seed-intake-blocks");
    expect(demo).toContain("seed-vnext");
    expect(demo).toContain("load-nafta-prices");
    expect(demo).toContain("seed-intake-blocks");
  });

  function mockPrisma(storedVersion: string | null) {
    const tx = {
      $executeRawUnsafe: jest.fn(async () => 0),
      $queryRawUnsafe: jest.fn(async () => []),
    };
    return {
      tx,
      icdCode: { count: jest.fn(async () => 42), deleteMany: jest.fn(), createMany: jest.fn() },
      clinicalDiagnosis: { deleteMany: jest.fn() },
      visitDiagnosis: { deleteMany: jest.fn() },
      admissionDiagnosis: { deleteMany: jest.fn() },
      tenant: {
        findFirst: jest.fn(async () => ({ icd10Version: storedVersion })),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
  }

  it("loadIcd10 skips when the stored version is current", async () => {
    const prisma = mockPrisma(ICD10_VERSION);
    const r = await loadIcd10(prisma);
    expect(r.skipped).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("loadIcd10 upserts by code and never deletes diagnoses", async () => {
    const prisma = mockPrisma("WHO-ICD-10-2019");
    const r = await loadIcd10(prisma);
    expect(r.skipped).toBe(false);
    const sql = prisma.tx.$executeRawUnsafe.mock.calls.map((c) => String((c as unknown[])[0]));
    expect(sql.some((s) => s.includes("ON CONFLICT (code) DO UPDATE"))).toBe(true);
    expect(sql.some((s) => s.includes("SET active = false"))).toBe(true);
    expect(sql.every((s) => !/TRUNCATE|DELETE FROM "(Clinical|Visit|Admission)Diagnosis"/i.test(s))).toBe(true);
    const del = sql.filter((s) => /DELETE/i.test(s));
    expect(del).toHaveLength(1);
    expect(del[0]).toMatch(/DELETE FROM "IcdCode"[\s\S]*NOT EXISTS[\s\S]*ClinicalDiagnosis[\s\S]*VisitDiagnosis[\s\S]*AdmissionDiagnosis/);
    for (const m of [prisma.icdCode, prisma.clinicalDiagnosis, prisma.visitDiagnosis, prisma.admissionDiagnosis]) {
      expect(m.deleteMany).not.toHaveBeenCalled();
    }
    expect(prisma.tenant.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({ icd10Version: ICD10_VERSION }),
    });
  });

  it("requireSeedOrgId fails without a real org (no demo-org)", () => {
    const prevA = process.env.ERA_SATELLITE_ORGANIZATION_ID;
    const prevB = process.env.ORGANIZATION_ID;
    delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
    delete process.env.ORGANIZATION_ID;
    expect(() => requireSeedOrgId()).toThrow(/demo-org is forbidden/i);
    process.env.ERA_SATELLITE_ORGANIZATION_ID = "demo-org";
    expect(() => requireSeedOrgId()).toThrow(/demo-org is forbidden/i);
    if (prevA === undefined) delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
    else process.env.ERA_SATELLITE_ORGANIZATION_ID = prevA;
    if (prevB === undefined) delete process.env.ORGANIZATION_ID;
    else process.env.ORGANIZATION_ID = prevB;
  });
});
