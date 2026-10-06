import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { localizedDepartmentName, type DepartmentNames } from "@/domain/catalog/department-label";

const CYRILLIC = /[А-Яа-яЁё]/;

/** Stable code shared with the SQL backfill (`md5` of the trimmed label). */
export function departmentCodeForLabel(label: string): string {
  const digest = createHash("md5").update(label.trim()).digest("hex").slice(0, 10).toUpperCase();
  return `DEPT-${digest}`;
}

export function departmentFallbackLabel(row: DepartmentNames): string {
  return row.nameAz?.trim() || row.nameRu?.trim() || row.nameEn?.trim() || row.code;
}

export async function listServiceDepartments() {
  const rows = await prisma.serviceDepartment.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { catalogRows: true } } },
  });
  return rows.map(({ _count, ...row }) => ({
    ...row,
    serviceCount: _count.catalogRows,
  }));
}

/** One card per distinct label. Existing cards are not overwritten. */
export async function ensureServiceDepartment(organizationId: string, label: string) {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const code = departmentCodeForLabel(trimmed);
  const existing = await prisma.serviceDepartment.findFirst({
    where: { organizationId, code },
  });
  if (existing) return existing;
  const cyrillic = CYRILLIC.test(trimmed);
  return prisma.serviceDepartment.create({
    data: {
      organizationId,
      code,
      nameAz: cyrillic ? null : trimmed,
      nameRu: cyrillic ? trimmed : null,
    },
  });
}

/**
 * Price row stores a department code. The legacy `department` string stays
 * the fallback label so kind inference and old filters keep a readable value.
 */
export async function resolveDepartmentWrite(
  organizationId: string,
  input: { departmentCode?: string | null; department?: string | null },
): Promise<{ departmentCode: string | null; department: string | null }> {
  const code = input.departmentCode?.trim();
  if (code) {
    const dept = await prisma.serviceDepartment.findFirst({
      where: { organizationId, code },
    });
    if (!dept) {
      const err = new Error("UNKNOWN_DEPARTMENT");
      throw err;
    }
    return {
      departmentCode: dept.code,
      department: departmentFallbackLabel(dept),
    };
  }
  const label = input.department?.trim();
  if (!label) return { departmentCode: null, department: null };
  const dept = await ensureServiceDepartment(organizationId, label);
  if (!dept) return { departmentCode: null, department: null };
  return {
    departmentCode: dept.code,
    department: departmentFallbackLabel(dept),
  };
}

export { localizedDepartmentName };
