import { prisma } from "@/lib/prisma";
import {
  localizedCatalogDescription,
  type CatalogDescriptionFields,
} from "@era/clinic-domain";

/** Batch-load catalog rows and resolve display names for procedure codes. */
export async function loadCatalogDisplayNameMap(
  codes: string[],
  locale: string,
): Promise<Map<string, string>> {
  const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const rows = await prisma.serviceCatalogCache.findMany({
    where: { code: { in: unique } },
    select: {
      code: true,
      description: true,
      descriptionAz: true,
      descriptionRu: true,
      descriptionEn: true,
    },
  });

  for (const row of rows) {
    map.set(row.code, localizedCatalogDescription(row, locale));
  }
  return map;
}

export function resolveOrderDisplayName(
  order: { procedureCode: string; procedureName?: string | null },
  catalogNames: Map<string, string>,
): string {
  return (
    catalogNames.get(order.procedureCode) ||
    order.procedureName?.trim() ||
    order.procedureCode
  );
}

export function catalogFieldsDisplayName(
  row: CatalogDescriptionFields,
  locale: string,
): string {
  return localizedCatalogDescription(row, locale);
}
