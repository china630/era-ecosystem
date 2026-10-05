import { prisma } from '@/lib/prisma';
import { civilWindow, round2, splitGross, ymdParam } from '@/lib/reports/civil-days';
import { loadChargeDays, loadRevenueCodes } from './stay-ledger';

export interface TrialBalanceLine {
  code: string;
  name: string;
  net: number;
  vat: number;
  gross: number;
}

export interface TrialBalanceDepartment extends TrialBalanceLine {
  codes: TrialBalanceLine[];
}

export interface TrialBalancePeriodResult {
  from: string;
  to: string;
  /** Guest ledger brought forward: all charges minus all payments before `from`. */
  openingBalance: number;
  departments: TrialBalanceDepartment[];
  chargesNet: number;
  chargesVat: number;
  chargesGross: number;
  /** Positive amounts; layouts print them negative. Refunds reduce the method total. */
  payments: { method: string; amount: number }[];
  paymentsTotal: number;
  closingBalance: number;
}

function signed(kind: string, amount: unknown): number {
  const n = Number(amount ?? 0);
  return kind === 'REFUND' ? -n : n;
}

export async function queryTrialBalancePeriod(
  fromParam: string | Date,
  toParam: string | Date,
): Promise<TrialBalancePeriodResult> {
  const from = ymdParam(fromParam);
  const to = ymdParam(toParam) < from ? from : ymdParam(toParam);
  const window = civilWindow(from, to);

  const [chargesBefore, paymentsBefore, chargeDays, codes, paymentsInPeriod] = await Promise.all([
    prisma.folioCharge.aggregate({ where: { businessDate: { lt: window.gte } }, _sum: { amount: true } }),
    prisma.folioPayment.groupBy({
      by: ['kind'],
      where: { createdAt: { lt: window.gte } },
      _sum: { amount: true },
    }),
    loadChargeDays(from, to),
    loadRevenueCodes(),
    prisma.folioPayment.groupBy({
      by: ['paymentMethod', 'kind'],
      where: { createdAt: { gte: window.gte, lt: window.lt } },
      _sum: { amount: true },
    }),
  ]);

  const openingBalance = round2(
    Number(chargesBefore._sum.amount ?? 0) - paymentsBefore.reduce((s, p) => s + signed(p.kind, p._sum.amount), 0),
  );

  const deptMap = new Map<string, TrialBalanceDepartment>();
  for (const c of chargeDays) {
    const code = codes.get(c.revenueCodeId);
    const split = splitGross(c.gross, code?.vatRate ?? 0);
    const deptCode = code?.departmentCode ?? 'OTHER';
    const dept =
      deptMap.get(deptCode) ??
      { code: deptCode, name: code?.departmentName ?? 'Other', net: 0, vat: 0, gross: 0, codes: [] };
    dept.net += split.net;
    dept.vat += split.vat;
    dept.gross += split.gross;
    const rcCode = code?.code ?? c.revenueCodeId;
    let line = dept.codes.find((l) => l.code === rcCode);
    if (!line) {
      line = { code: rcCode, name: code?.name ?? rcCode, net: 0, vat: 0, gross: 0 };
      dept.codes.push(line);
    }
    line.net += split.net;
    line.vat += split.vat;
    line.gross += split.gross;
    deptMap.set(deptCode, dept);
  }

  const departments = [...deptMap.values()]
    .map((d) => ({
      ...d,
      net: round2(d.net),
      vat: round2(d.vat),
      gross: round2(d.gross),
      codes: d.codes
        .map((l) => ({ ...l, net: round2(l.net), vat: round2(l.vat), gross: round2(l.gross) }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const payMap = new Map<string, number>();
  for (const p of paymentsInPeriod) {
    payMap.set(p.paymentMethod, (payMap.get(p.paymentMethod) ?? 0) + signed(p.kind, p._sum.amount));
  }
  const payments = [...payMap.entries()]
    .map(([method, amount]) => ({ method, amount: round2(amount) }))
    .sort((a, b) => a.method.localeCompare(b.method));

  const chargesGross = round2(departments.reduce((s, d) => s + d.gross, 0));
  const paymentsTotal = round2(payments.reduce((s, p) => s + p.amount, 0));
  return {
    from,
    to,
    openingBalance,
    departments,
    chargesNet: round2(departments.reduce((s, d) => s + d.net, 0)),
    chargesVat: round2(departments.reduce((s, d) => s + d.vat, 0)),
    chargesGross,
    payments,
    paymentsTotal,
    closingBalance: round2(openingBalance + chargesGross - paymentsTotal),
  };
}
