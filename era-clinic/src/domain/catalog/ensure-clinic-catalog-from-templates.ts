/**
 * Copy satellite catalog templates into an org overlay.
 * Missing services are inserted. Analytes are copied only with a service
 * created in this pass — an existing SatAdmin panel is not refilled.
 * Pre-canon template codes (ECG-12) resolve to the canon code (CARDIO-ECG)
 * and are not inserted as a second row.
 * ADR: docs/adr/clinic-catalog-template-overlay.md
 */
import type { PrismaClient } from "@prisma/client";
import { invalidateDiagnosticCatalogCache } from "@/domain/catalog/diagnostic-catalog";
import catalogCodeCanon from "../../../prisma/seed-data/catalog-code-canon.map.json";

const CODE_CANON: Record<string, string> = catalogCodeCanon;

function canonCode(code: string): string {
  return CODE_CANON[code] ?? code;
}

function canonIncludes(includesJson: string | null): string | null {
  if (!includesJson) return includesJson;
  let arr: unknown;
  try {
    arr = JSON.parse(includesJson);
  } catch {
    return includesJson;
  }
  if (!Array.isArray(arr)) return includesJson;
  const next = arr.map((item) => (typeof item === "string" ? canonCode(item) : item));
  return JSON.stringify(next);
}

type CatalogDb = Pick<
  PrismaClient,
  | "physioSiteTemplate"
  | "physioListItemTemplate"
  | "physioSite"
  | "physioListItem"
  | "modalityTemplate"
  | "diagnosticServiceTemplate"
  | "diagnosticAnalyteTemplate"
  | "modality"
  | "diagnosticService"
  | "diagnosticAnalyte"
>;

export type EnsureClinicCatalogResult = {
  organizationId: string;
  physioSitesCreated: number;
  physioListCreated: number;
  modalitiesCreated: number;
  servicesCreated: number;
  analytesCreated: number;
};

/**
 * For each template code missing on the org, insert an overlay row.
 * Does not add analytes onto a service that already exists.
 */
export async function ensureClinicCatalogFromTemplates(
  db: CatalogDb,
  organizationId: string,
): Promise<EnsureClinicCatalogResult> {
  const orgId = organizationId.trim();
  if (!orgId || orgId === "demo-org") {
    throw new Error("organizationId required for ensureClinicCatalogFromTemplates");
  }

  const result: EnsureClinicCatalogResult = {
    organizationId: orgId,
    physioSitesCreated: 0,
    physioListCreated: 0,
    modalitiesCreated: 0,
    servicesCreated: 0,
    analytesCreated: 0,
  };

  const siteTemplates = await db.physioSiteTemplate.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  for (const t of siteTemplates) {
    const existing = await db.physioSite.findUnique({
      where: { organizationId_code: { organizationId: orgId, code: t.code } },
    });
    if (existing) continue;
    await db.physioSite.create({
      data: {
        organizationId: orgId,
        code: t.code,
        kind: t.kind,
        prikaz817: t.prikaz817,
        laterality: t.laterality,
        titleAz: t.titleAz,
        titleRu: t.titleRu,
        titleEn: t.titleEn,
        titleLa: t.titleLa,
        boundary: t.boundary,
        coarse: t.coarse,
        anatomyJson: t.anatomyJson,
        active: t.active,
        sortOrder: t.sortOrder,
      },
    });
    result.physioSitesCreated += 1;
  }

  const listTemplates = await db.physioListItemTemplate.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  for (const t of listTemplates) {
    const existing = await db.physioListItem.findUnique({
      where: {
        organizationId_listKind_code: {
          organizationId: orgId,
          listKind: t.listKind,
          code: t.code,
        },
      },
    });
    if (existing) continue;
    await db.physioListItem.create({
      data: {
        organizationId: orgId,
        listKind: t.listKind,
        code: t.code,
        titleAz: t.titleAz,
        titleRu: t.titleRu,
        titleEn: t.titleEn,
        active: t.active,
        sortOrder: t.sortOrder,
      },
    });
    result.physioListCreated += 1;
  }

  const modalityTemplates = await db.modalityTemplate.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      services: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: { analytes: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  for (const mt of modalityTemplates) {
    let modality = await db.modality.findUnique({
      where: { organizationId_code: { organizationId: orgId, code: mt.code } },
    });
    if (!modality) {
      modality = await db.modality.create({
        data: {
          organizationId: orgId,
          code: mt.code,
          kind: mt.kind,
          titleEn: mt.titleEn,
          titleRu: mt.titleRu,
          titleAz: mt.titleAz,
          sortOrder: mt.sortOrder,
          active: mt.active,
        },
      });
      result.modalitiesCreated += 1;
    }

    for (const st of mt.services) {
      const code = canonCode(st.code);
      const serviceCode = canonCode(st.serviceCode);
      let service = await db.diagnosticService.findUnique({
        where: { organizationId_code: { organizationId: orgId, code } },
      });
      if (service) continue;

      service = await db.diagnosticService.create({
        data: {
          organizationId: orgId,
          code,
          modalityId: modality.id,
          category: st.category,
          kind: st.kind,
          titleEn: st.titleEn,
          titleRu: st.titleRu,
          titleAz: st.titleAz,
          serviceCode,
          fieldsJson: st.fieldsJson,
          includesJson: canonIncludes(st.includesJson),
          sortOrder: st.sortOrder,
          active: st.active,
        },
      });
      result.servicesCreated += 1;

      for (const at of st.analytes) {
        await db.diagnosticAnalyte.create({
          data: {
            organizationId: orgId,
            serviceId: service.id,
            code: at.code,
            unit: at.unit,
            labelEn: at.labelEn,
            labelRu: at.labelRu,
            labelAz: at.labelAz,
            refMin: at.refMin,
            refMax: at.refMax,
            section: at.section,
            valueType: at.valueType,
            sortOrder: at.sortOrder,
          },
        });
        result.analytesCreated += 1;
      }
    }
  }

  if (
    result.physioSitesCreated +
      result.physioListCreated +
      result.modalitiesCreated +
      result.servicesCreated +
      result.analytesCreated >
    0
  ) {
    invalidateDiagnosticCatalogCache(orgId);
  }

  return result;
}

/**
 * Cheap gate: copy-if-empty only when the org overlay is missing physio sites or modalities.
 * Safe on every catalog GET (SHARED second org, cron, bind skipped).
 */
export async function ensureClinicCatalogIfEmpty(
  db: CatalogDb,
  organizationId: string,
): Promise<EnsureClinicCatalogResult | { skipped: true; organizationId: string }> {
  const orgId = organizationId.trim();
  if (!orgId || orgId === "demo-org") {
    throw new Error("organizationId required for ensureClinicCatalogIfEmpty");
  }
  const [sites, modalities] = await Promise.all([
    db.physioSite.count({ where: { organizationId: orgId } }),
    db.modality.count({ where: { organizationId: orgId } }),
  ]);
  if (sites > 0 && modalities > 0) {
    return { skipped: true, organizationId: orgId };
  }
  return ensureClinicCatalogFromTemplates(db, orgId);
}
