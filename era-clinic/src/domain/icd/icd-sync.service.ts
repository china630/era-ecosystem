import { prisma } from "@/lib/prisma";
import { platformCatalogGet } from "@era/satellite-kit";
import { ICD10_VERSION } from "@/domain/icd/icd-catalog";

export type Icd10GatewayPage = {
  version: string;
  items: Array<{
    code: string;
    kind: string;
    chapterCode: string;
    blockCode: string;
    parentCode: string | null;
    titleEn: string;
    titleRu: string;
    titleAz: string | null;
    searchText: string;
    selectable: boolean;
    active: boolean;
  }>;
  total?: number;
  nextCursor?: string | null;
};

async function reloadFromBundledDump() {
  const { loadIcd10 } = await import("../../../prisma/load-icd10.cjs");
  return loadIcd10(prisma as any, { force: true });
}

export async function getLocalIcd10Version() {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  const count = await prisma.icdCode.count();
  return {
    version: tenant?.icd10Version ?? ICD10_VERSION,
    syncedAt: tenant?.icd10SyncedAt ?? null,
    count,
    source: tenant?.icd10SyncedAt ? "gateway-or-file" : "local-file",
  };
}

/** Pull catalog from orchestrator gateway; fall back to bundled WHO dump. */
export async function syncIcd10FromGatewayOrFile() {
  const remote = await platformCatalogGet<Icd10GatewayPage>("/icd10?take=1");
  if (!remote?.version) {
    return reloadFromBundledDump();
  }
  const page = await platformCatalogGet<Icd10GatewayPage>(`/icd10?take=50000`);
  if (!page?.items?.length) {
    return reloadFromBundledDump();
  }

  await prisma.admissionDiagnosis.deleteMany();
  await prisma.visitDiagnosis.deleteMany();
  await prisma.clinicalDiagnosis.deleteMany();
  await prisma.icdCode.deleteMany();

  const batchSize = 800;
  for (let i = 0; i < page.items.length; i += batchSize) {
    const slice = page.items.slice(i, i + batchSize).map((r) => ({
      code: r.code,
      kind: r.kind as "CHAPTER" | "BLOCK" | "CATEGORY" | "LEAF",
      chapterCode: r.chapterCode,
      blockCode: r.blockCode,
      parentCode: r.parentCode,
      titleEn: r.titleEn,
      titleRu: r.titleRu,
      titleAz: r.titleAz,
      searchText: r.searchText,
      selectable: r.selectable,
      active: r.active,
    }));
    await prisma.icdCode.createMany({ data: slice });
  }

  await prisma.tenant.updateMany({
    data: { icd10Version: page.version, icd10SyncedAt: new Date() },
  });

  return {
    skipped: false,
    loaded: page.items.length,
    version: page.version,
    source: "orchestrator",
  };
}
