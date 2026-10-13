import { prisma } from "@/lib/prisma";
import { platformCatalogGet } from "@era/satellite-kit";
import { ICD10_VERSION } from "@/domain/icd/icd-catalog";

export type Icd10GatewayRow = {
  code: string;
  kind: string;
  chapterCode: string;
  blockCode: string;
  parentCode: string | null;
  titleEn: string;
  titleRu: string | null;
  titleAz: string | null;
  searchText: string;
  selectable: boolean;
  active: boolean;
};

export type Icd10GatewayPage = {
  version: string;
  items: Icd10GatewayRow[];
  total?: number;
  nextCursor?: string | null;
};

type LoadResult = { skipped: boolean; version?: string; loaded?: number; retired?: number };

async function upsertCatalog(opts: { force: boolean; catalog?: { version: string; rows: Icd10GatewayRow[] } }) {
  const { loadIcd10 } = await import("../../../prisma/load-icd10.cjs");
  return (await loadIcd10(prisma as any, opts)) as LoadResult;
}

export async function getLocalIcd10Version() {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  const count = await prisma.icdCode.count();
  return {
    version: tenant?.icd10Version ?? ICD10_VERSION,
    syncedAt: tenant?.icd10SyncedAt ?? null,
    count,
    source: tenant?.icd10Source ?? (tenant?.icd10SyncedAt ? "unknown" : "local-file"),
  };
}

/**
 * Pull the full catalog from the orchestrator gateway; fall back to the bundled WHO dump.
 * Upsert by code only — diagnoses are never deleted.
 */
export async function syncIcd10FromGatewayOrFile() {
  const page = await platformCatalogGet<Icd10GatewayPage>("/icd10?take=50000&selectable=0");
  if (!page?.version || !page.items?.length || page.nextCursor) {
    return finishBundledFallback();
  }

  const loaded = await upsertCatalog({
    force: true,
    catalog: { version: page.version, rows: page.items },
  });
  await markIcdSource("orchestrator", page.version);
  return { ...loaded, source: "orchestrator" };
}

async function finishBundledFallback() {
  const loaded = await upsertCatalog({ force: true });
  if (!loaded.skipped && loaded.version) {
    await markIcdSource("bundled", loaded.version);
  }
  return { ...loaded, source: loaded.skipped ? "unchanged" : "bundled" };
}

async function markIcdSource(source: "orchestrator" | "bundled", version?: string) {
  await prisma.tenant.updateMany({
    data: {
      icd10Source: source,
      icd10SyncedAt: new Date(),
      ...(version ? { icd10Version: version } : {}),
    },
  });
}
