import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

function dayStart(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

export interface TrialBalanceRow {
  department: string;
  departmentName: string;
  bf: number;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalancePeriodResult {
  from: string;
  to: string;
  rows: TrialBalanceRow[];
  totalBf: number;
  totalDebit: number;
  totalCredit: number;
  totalBalance: number;
}

export async function queryTrialBalancePeriod(
  fromIso: string,
  toIso: string,
): Promise<TrialBalancePeriodResult> {
  const fromDate = dayStart(fromIso);
  const toDate = dayStart(toIso);
  const toNext = new Date(toDate);
  toNext.setUTCDate(toNext.getUTCDate() + 1);

  const [chargesBefore, chargesInPeriod, paymentsInPeriod] = await Promise.all([
    prisma.folioCharge.groupBy({
      by: ['departmentId'],
      where: { businessDate: { lt: fromDate }, departmentId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.folioCharge.groupBy({
      by: ['departmentId'],
      where: {
        businessDate: { gte: fromDate, lt: toNext },
        departmentId: { not: null },
      },
      _sum: { amount: true },
    }),
    prisma.folioPayment.groupBy({
      by: ['paymentMethod'],
      where: { createdAt: { gte: fromDate, lt: toNext } },
      _sum: { amount: true },
    }),
  ]);

  const departments = await prisma.department.findMany({
    select: { id: true, code: true, name: true },
  });
  const deptMap = new Map(departments.map((d) => [d.id, d]));

  const totalPayments = paymentsInPeriod.reduce(
    (s, p) => s + Number(p._sum.amount ?? 0),
    0,
  );

  const bfMap = new Map<string, number>();
  for (const row of chargesBefore) {
    if (row.departmentId) bfMap.set(row.departmentId, Number(row._sum.amount ?? 0));
  }

  const debitMap = new Map<string, number>();
  for (const row of chargesInPeriod) {
    if (row.departmentId) debitMap.set(row.departmentId, Number(row._sum.amount ?? 0));
  }

  const allDeptIds = new Set([...bfMap.keys(), ...debitMap.keys()]);
  const rows: TrialBalanceRow[] = [];

  for (const deptId of allDeptIds) {
    const dept = deptMap.get(deptId);
    const bf = bfMap.get(deptId) ?? 0;
    const debit = debitMap.get(deptId) ?? 0;
    rows.push({
      department: dept?.code ?? deptId,
      departmentName: dept?.name ?? deptId,
      bf,
      debit,
      credit: 0,
      balance: bf + debit,
    });
  }

  rows.push({
    department: 'PAYMENTS',
    departmentName: 'Payments',
    bf: 0,
    debit: 0,
    credit: totalPayments,
    balance: -totalPayments,
  });

  for (const pm of paymentsInPeriod) {
    rows.push({
      department: `PAY:${pm.paymentMethod}`,
      departmentName: pm.paymentMethod,
      bf: 0,
      debit: 0,
      credit: Number(pm._sum.amount ?? 0),
      balance: -Number(pm._sum.amount ?? 0),
    });
  }

  const totalBf = rows.reduce((s, r) => s + r.bf, 0);
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);

  return { from: fromIso, to: toIso, rows, totalBf, totalDebit, totalCredit, totalBalance };
}
