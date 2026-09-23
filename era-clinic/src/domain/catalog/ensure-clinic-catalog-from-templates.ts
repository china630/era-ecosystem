/**
 * Copy satellite catalog templates into an org overlay (copy-if-empty per code).
 * ADR: docs/adr/clinic-catalog-template-overlay.md
 */
import type { PrismaClient } from "@prisma/client";
import { invalidateDiagnosticCatalogCache } from "@/domain/catalog/diagnostic-catalog";

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
 * Never overwrites existing SatAdmin / import rows.
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
      let service = await db.diagnosticService.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: st.code } },
      });
      if (!service) {
        service = await db.diagnosticService.create({
          data: {
            organizationId: orgId,
            code: st.code,
            modalityId: modality.id,
            category: st.category,
            kind: st.kind,
            titleEn: st.titleEn,
            titleRu: st.titleRu,
            titleAz: st.titleAz,
            serviceCode: st.serviceCode,
            fieldsJson: st.fieldsJson,
            includesJson: st.includesJson,
            sortOrder: st.sortOrder,
            active: st.active,
          },
        });
        result.servicesCreated += 1;
      }

      for (const at of st.analytes) {
        const existingA = await db.diagnosticAnalyte.findUnique({
          where: { serviceId_code: { serviceId: service.id, code: at.code } },
        });
        if (existingA) continue;
        await db.diagnosticAnalyte.create({
          data: {
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
