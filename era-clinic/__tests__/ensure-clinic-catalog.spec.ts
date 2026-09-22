/**
 * Unit: ensureClinicCatalogIfEmpty skips when overlay already present.
 * Run: npx jest __tests__/ensure-clinic-catalog.spec.ts --ci
 */
import { ensureClinicCatalogIfEmpty } from "@/domain/catalog/ensure-clinic-catalog-from-templates";

describe("ensureClinicCatalogIfEmpty", () => {
  it("skips when org already has physio sites and modalities", async () => {
    const db = {
      physioSite: { count: jest.fn().mockResolvedValue(2) },
      modality: { count: jest.fn().mockResolvedValue(3) },
      physioSiteTemplate: { findMany: jest.fn() },
      modalityTemplate: { findMany: jest.fn() },
    };
    const orgId = "00000000-0000-4000-8000-0000000000aa";
    const result = await ensureClinicCatalogIfEmpty(db as never, orgId);
    expect(result).toEqual({ skipped: true, organizationId: orgId });
    expect(db.physioSiteTemplate.findMany).not.toHaveBeenCalled();
  });

  it("rejects demo-org", async () => {
    const db = {
      physioSite: { count: jest.fn() },
      modality: { count: jest.fn() },
    };
    await expect(
      ensureClinicCatalogIfEmpty(db as never, "demo-org"),
    ).rejects.toThrow(/organizationId required/);
  });
});
