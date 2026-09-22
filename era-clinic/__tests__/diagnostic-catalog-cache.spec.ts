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
          services: [],
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
    expect(a.items).toHaveLength(0);
    expect(b.items).toHaveLength(0);
    // Groups keyed by modality code include org-specific modality from mock
    expect(a.groups.some((g) => g.modality === "MOD-org-a")).toBe(true);
    expect(b.groups.some((g) => g.modality === "MOD-org-b")).toBe(true);
  });
});
