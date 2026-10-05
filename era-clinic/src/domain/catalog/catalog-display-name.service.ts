import { prisma } from "@/lib/prisma";
import { localizedDepartmentName } from "@/domain/catalog/department-label";
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

/** Replace ProcedureType.name with the catalog string and attach the department. */
export async function overlayProcedureTypeNames<T extends { code: string; name: string }>(
  rows: T[],
  locale: string,
): Promise<Array<T & { departmentCode: string | null; departmentName: string }>> {
  const unique = [...new Set(rows.map((row) => row.code.trim()).filter(Boolean))];
  const catalog = unique.length
    ? await prisma.serviceCatalogCache.findMany({
        where: { code: { in: unique } },
        select: {
          code: true,
          description: true,
          descriptionAz: true,
          descriptionRu: true,
          descriptionEn: true,
          departmentCode: true,
          department: true,
        },
      })
    : [];
  const byCode = new Map(catalog.map((row) => [row.code, row]));
  const deptCodes = [...new Set(catalog.map((row) => row.departmentCode).filter(Boolean))] as string[];
  const departments = deptCodes.length
    ? await prisma.serviceDepartment.findMany({ where: { code: { in: deptCodes } } })
    : [];
  const deptByCode = new Map(departments.map((row) => [row.code, row]));
  return rows.map((row) => {
    const cat = byCode.get(row.code);
    const dept = cat?.departmentCode ? deptByCode.get(cat.departmentCode) : undefined;
    return {
      ...row,
      name: cat ? localizedCatalogDescription(cat, locale) : row.name,
      departmentCode: cat?.departmentCode ?? null,
      departmentName: dept
        ? localizedDepartmentName(dept, locale)
        : cat?.department?.trim() || "",
    };
  });
}
