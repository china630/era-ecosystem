/**
 * Unit: ensureClinicCatalogIfEmpty skips when overlay already present.
 * Run: npx jest __tests__/ensure-clinic-catalog.spec.ts --ci
 */
import {
  ensureClinicCatalogFromTemplates,
  ensureClinicCatalogIfEmpty,
} from "@/domain/catalog/ensure-clinic-catalog-from-templates";

jest.mock("@/domain/catalog/diagnostic-catalog", () => ({
  invalidateDiagnosticCatalogCache: jest.fn(),
}));

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

describe("ensureClinicCatalogFromTemplates", () => {
  const orgId = "00000000-0000-4000-8000-0000000000aa";

  function dbWith(services: Array<{ code: string; analytes?: Array<{ code: string }> }>) {
    const analyteCreate = jest.fn().mockResolvedValue({ id: "a-new" });
    const serviceCreate = jest.fn().mockImplementation(async ({ data }: { data: { code: string } }) => ({
      id: `svc-${data.code}`,
      ...data,
    }));
    const known = new Map(services.map((s) => [s.code, s]));
    return {
      analyteCreate,
      serviceCreate,
      db: {
        physioSiteTemplate: { findMany: jest.fn().mockResolvedValue([]) },
        physioListItemTemplate: { findMany: jest.fn().mockResolvedValue([]) },
        modalityTemplate: {
          findMany: jest.fn().mockResolvedValue([
            {
              code: "FUNC",
              kind: "functional",
              titleEn: "Functional",
              titleRu: "Functional",
              titleAz: "Functional",
              sortOrder: 1,
              active: true,
              services: [
                {
                  code: "ECG-12",
                  serviceCode: "ECG-12",
                  category: "",
                  kind: "functional",
                  titleEn: "ECG",
                  titleRu: "ЭКГ",
                  titleAz: "EKQ",
                  fieldsJson: null,
                  includesJson: null,
                  sortOrder: 1,
                  active: true,
                  analytes: [{ code: "HR", unit: "bpm", labelEn: "HR", labelRu: "ЧСС", labelAz: "ÜRƏK", refMin: null, refMax: null, section: null, valueType: "NUMERIC", sortOrder: 1 }],
                },
              ],
            },
          ]),
        },
        modality: {
          findUnique: jest.fn().mockResolvedValue({ id: "mod-1" }),
        },
        diagnosticService: {
          findUnique: jest.fn().mockImplementation(async ({ where }: { where: { organizationId_code: { code: string } } }) => {
            const row = known.get(where.organizationId_code.code);
            return row ? { id: `svc-${row.code}`, code: row.code } : null;
          }),
          create: serviceCreate,
        },
        diagnosticAnalyte: {
          create: analyteCreate,
        },
      },
    };
  }

  it("does not refill analytes onto a service that already exists", async () => {
    const { db, analyteCreate, serviceCreate } = dbWith([{ code: "CARDIO-ECG" }]);
    const result = await ensureClinicCatalogFromTemplates(db as never, orgId);
    expect(serviceCreate).not.toHaveBeenCalled();
    expect(analyteCreate).not.toHaveBeenCalled();
    expect(result.analytesCreated).toBe(0);
    expect(result.servicesCreated).toBe(0);
  });

  it("creates the canon code instead of a pre-canon template alias", async () => {
    const { db, serviceCreate, analyteCreate } = dbWith([]);
    const result = await ensureClinicCatalogFromTemplates(db as never, orgId);
    expect(serviceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: "CARDIO-ECG", serviceCode: "CARDIO-ECG" }),
      }),
    );
    expect(analyteCreate).toHaveBeenCalledTimes(1);
    expect(result.servicesCreated).toBe(1);
    expect(result.analytesCreated).toBe(1);
  });
});
