import { readFileSync } from "node:fs";
import { join } from "node:path";
import { requireSeedOrgId } from "../prisma/seed-physio-catalog-lib";

const { loadIcd10 } = require("../prisma/load-icd10.cjs") as {
  loadIcd10: (
    prisma: unknown,
    opts?: { force?: boolean },
  ) => Promise<{ skipped?: boolean; existing?: number }>;
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

  it("loadIcd10 skips when rows exist and force is off", async () => {
    const prisma = {
      icdCode: { count: async () => 42, deleteMany: jest.fn(), createMany: jest.fn() },
      clinicalDiagnosis: { count: jest.fn() },
      visitDiagnosis: { count: jest.fn() },
      admissionDiagnosis: { count: jest.fn() },
      tenant: { updateMany: jest.fn() },
    };
    const r = await loadIcd10(prisma);
    expect(r.skipped).toBe(true);
    expect(prisma.icdCode.deleteMany).not.toHaveBeenCalled();
    expect(prisma.icdCode.createMany).not.toHaveBeenCalled();
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
