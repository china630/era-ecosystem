/**
 * Per-org diagnostic catalog cache (SHARED-safe).
 */
import {
  getDiagnosticCatalog,
  invalidateDiagnosticCatalogCache,
} from "@/domain/catalog/diagnostic-catalog";

jest.mock("@/domain/catalog/ensure-clinic-catalog-from-templates", () => ({
  ensureClinicCatalogIfEmpty: jest.fn().mockResolvedValue({ skipped: true }),
  ensureClinicCatalogFromTemplates: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    modality: {
      findMany: jest.fn(async ({ where }: { where: { organizationId: string } }) => [
        {
          code: `MOD-${where.organizationId}`,
          kind: "imaging",
          titleEn: "X",
          titleRu: "X",
          titleAz: "X",
          sortOrder: 0,
          services: [
            {
              code: "SVC",
              kind: "imaging",
              titleEn: "USM",
              titleRu: "USM",
              titleAz: "USM",
              serviceCode: "USM",
              category: "abdomen",
              sortOrder: 0,
              fieldsJson: null,
              includesJson: null,
              analytes: [],
            },
          ],
        },
      ]),
      count: jest.fn(async () => 1),
    },
    physioSite: {
      count: jest.fn(async () => 1),
    },
    diagnosticMetaField: {
      findMany: jest.fn(async () => []),
    },
    diagnosticCategory: {
      findMany: jest.fn(async () => []),
    },
  },
}));

jest.mock("@/lib/request-organization", () => ({
  requestOrganizationId: () => {
    throw new Error("should pass org explicitly in test");
  },
}));

describe("getDiagnosticCatalog per-org cache", () => {
  beforeEach(() => {
    invalidateDiagnosticCatalogCache();
  });

  it("caches separately per organizationId", async () => {
    const a = await getDiagnosticCatalog("org-a");
    const b = await getDiagnosticCatalog("org-b");
    expect(a.items).toHaveLength(1);
    expect(b.items).toHaveLength(1);
    expect(a.groups).toEqual([
      expect.objectContaining({
        key: "mod:MOD-org-a",
        modality: "MOD-org-a",
        category: null,
        title: { en: "X", ru: "X", az: "X" },
        itemCodes: ["SVC"],
      }),
    ]);
    expect(b.groups.map((g) => g.key)).toEqual(["mod:MOD-org-b"]);
    expect(a.groups.some((g) => g.category === "abdomen")).toBe(false);
  });
});
