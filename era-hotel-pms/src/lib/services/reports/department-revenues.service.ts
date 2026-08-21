import { prisma } from '@/lib/prisma';

function dayStart(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function dayEndExclusive(iso: string) {
  const d = dayStart(iso);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export interface DepartmentRevenueRow {
  department: string;
  departmentName: string;
  revenueCode: string;
  revenueCodeName: string;
  count: number;
  amount: number;
  pctOfTotal: number;
}

export interface DepartmentRevenuesResult {
  from: string;
  to: string;
  rows: DepartmentRevenueRow[];
  grandTotal: number;
}

export async function queryDepartmentRevenues(
  fromIso: string,
  toIso: string,
): Promise<DepartmentRevenuesResult> {
  const from = dayStart(fromIso);
  const to = dayEndExclusive(toIso);

  const grouped = await prisma.folioCharge.groupBy({
    by: ['departmentId', 'revenueCodeId'],
    where: {
      businessDate: { gte: from, lt: to },
    },
    _sum: { amount: true },
    _count: { id: true },
  });

  const deptIds = [...new Set(grouped.map((g) => g.departmentId).filter(Boolean))] as string[];
  const rcIds = [...new Set(grouped.map((g) => g.revenueCodeId))] as string[];

  const [departments, revenueCodes] = await Promise.all([
    deptIds.length > 0
      ? prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, code: true, name: true } })
      : [],
    rcIds.length > 0
      ? prisma.revenueCode.findMany({ where: { id: { in: rcIds } }, select: { id: true, code: true, name: true } })
      : [],
  ]);

  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const rcMap = new Map(revenueCodes.map((r) => [r.id, r]));

  const grandTotal = grouped.reduce((s, g) => s + Number(g._sum.amount ?? 0), 0);

  const rows: DepartmentRevenueRow[] = grouped.map((g) => {
    const dept = g.departmentId ? deptMap.get(g.departmentId) : null;
    const rc = rcMap.get(g.revenueCodeId);
    const amount = Number(g._sum.amount ?? 0);
    return {
      department: dept?.code ?? 'N/A',
      departmentName: dept?.name ?? 'N/A',
      revenueCode: rc?.code ?? g.revenueCodeId,
      revenueCodeName: rc?.name ?? g.revenueCodeId,
      count: g._count.id,
      amount,
      pctOfTotal: grandTotal > 0 ? Math.round((amount / grandTotal) * 10000) / 100 : 0,
    };
  });

  rows.sort((a, b) => a.department.localeCompare(b.department) || a.revenueCode.localeCompare(b.revenueCode));

  return { from: fromIso, to: toIso, rows, grandTotal };
}
