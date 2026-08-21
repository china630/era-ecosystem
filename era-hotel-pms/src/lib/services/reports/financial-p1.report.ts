import { prisma } from '@/lib/prisma';

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayStart(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

// ── trial-balance (single day, not period) ──

export interface TrialBalanceRow {
  departmentCode: string;
  departmentName: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalanceResult {
  businessDate: string;
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  totalBalance: number;
}

export async function queryTrialBalance(businessDate: Date): Promise<TrialBalanceResult> {
  const dateIso = toIso(businessDate);
  const start = dayStart(dateIso);

  const charges = await prisma.folioCharge.findMany({
    where: { businessDate: start },
    select: {
      amount: true,
      department: { select: { code: true, name: true } },
      revenueCode: { select: { department: { select: { code: true, name: true } } } },
    },
  });

  const payments = await prisma.folioPayment.findMany({
    where: { createdAt: { gte: start, lt: addDays(start, 1) } },
    select: { amount: true, kind: true },
  });

  const deptMap = new Map<string, { code: string; name: string; debit: number; credit: number }>();
  for (const c of charges) {
    const dept = c.department ?? c.revenueCode?.department;
    const code = dept?.code ?? 'OTHER';
    const name = dept?.name ?? 'Other';
    const e = deptMap.get(code) ?? { code, name, debit: 0, credit: 0 };
    e.debit += Number(c.amount);
    deptMap.set(code, e);
  }

  for (const p of payments) {
    const code = 'PAYMENTS';
    const e = deptMap.get(code) ?? { code, name: 'Payments', debit: 0, credit: 0 };
    if (p.kind === 'REFUND') {
      e.debit += Number(p.amount);
    } else {
      e.credit += Number(p.amount);
    }
    deptMap.set(code, e);
  }

  const rows: TrialBalanceRow[] = [...deptMap.values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((d) => ({
      departmentCode: d.code,
      departmentName: d.name,
      debit: Math.round(d.debit * 100) / 100,
      credit: Math.round(d.credit * 100) / 100,
      balance: Math.round((d.debit - d.credit) * 100) / 100,
    }));

  return {
    businessDate: dateIso,
    rows,
    totalDebit: rows.reduce((s, r) => s + r.debit, 0),
    totalCredit: rows.reduce((s, r) => s + r.credit, 0),
    totalBalance: rows.reduce((s, r) => s + r.balance, 0),
  };
}

// ── department-payments ──

export interface DepartmentPaymentsRow {
  departmentCode: string;
  departmentName: string;
  paymentMethod: string;
  count: number;
  total: number;
}

export interface DepartmentPaymentsResult {
  businessDate: string;
  rows: DepartmentPaymentsRow[];
  grandTotal: number;
}

export async function queryDepartmentPayments(businessDate: Date): Promise<DepartmentPaymentsResult> {
  const dateIso = toIso(businessDate);
  const start = dayStart(dateIso);

  const payments = await prisma.folioPayment.findMany({
    where: {
      kind: 'PAYMENT',
      createdAt: { gte: start, lt: addDays(start, 1) },
    },
    select: {
      amount: true,
      paymentMethod: true,
      folio: {
        select: {
          reservation: {
            select: {
              room: { select: { roomNumber: true } },
            },
          },
        },
      },
    },
  });

  const key = (dept: string, method: string) => `${dept}|${method}`;
  const map = new Map<string, DepartmentPaymentsRow>();
  for (const p of payments) {
    const dept = 'FRONT_OFFICE';
    const deptName = 'Front Office';
    const k = key(dept, p.paymentMethod);
    const e = map.get(k) ?? { departmentCode: dept, departmentName: deptName, paymentMethod: p.paymentMethod, count: 0, total: 0 };
    e.count++;
    e.total += Number(p.amount);
    map.set(k, e);
  }

  const rows = [...map.values()].sort((a, b) => a.departmentCode.localeCompare(b.departmentCode) || a.paymentMethod.localeCompare(b.paymentMethod));
  rows.forEach((r) => { r.total = Math.round(r.total * 100) / 100; });
  return { businessDate: dateIso, rows, grandTotal: rows.reduce((s, r) => s + r.total, 0) };
}

// ── cumulative-revenue ──

export interface CumulativeRevenueRow {
  date: string;
  departmentCode: string;
  departmentName: string;
  dailyAmount: number;
  cumulativeAmount: number;
}

export interface CumulativeRevenueResult {
  rows: CumulativeRevenueRow[];
}

export async function queryCumulativeRevenue(from: Date, to: Date): Promise<CumulativeRevenueResult> {
  const windowStart = dayStart(toIso(from));
  const windowEnd = addDays(dayStart(toIso(to)), 1);

  const charges = await prisma.folioCharge.findMany({
    where: { businessDate: { gte: windowStart, lt: windowEnd } },
    select: {
      businessDate: true,
      amount: true,
      department: { select: { code: true, name: true } },
      revenueCode: { select: { department: { select: { code: true, name: true } } } },
    },
    orderBy: { businessDate: 'asc' },
  });

  const cumMap = new Map<string, number>();
  const dailyMap = new Map<string, Map<string, { code: string; name: string; amount: number }>>();

  for (const c of charges) {
    const dept = c.department ?? c.revenueCode?.department;
    const code = dept?.code ?? 'OTHER';
    const name = dept?.name ?? 'Other';
    const dateStr = toIso(c.businessDate);

    if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, new Map());
    const dayDepts = dailyMap.get(dateStr)!;
    const e = dayDepts.get(code) ?? { code, name, amount: 0 };
    e.amount += Number(c.amount);
    dayDepts.set(code, e);
  }

  const rows: CumulativeRevenueRow[] = [];
  const sortedDates = [...dailyMap.keys()].sort();
  for (const dateStr of sortedDates) {
    const dayDepts = dailyMap.get(dateStr)!;
    for (const [code, val] of dayDepts) {
      const prev = cumMap.get(code) ?? 0;
      const cum = prev + val.amount;
      cumMap.set(code, cum);
      rows.push({
        date: dateStr,
        departmentCode: code,
        departmentName: val.name,
        dailyAmount: Math.round(val.amount * 100) / 100,
        cumulativeAmount: Math.round(cum * 100) / 100,
      });
    }
  }
  return { rows };
}

// ── dept-currency ──

export interface DeptCurrencyRow {
  departmentCode: string;
  departmentName: string;
  currencyCode: string;
  total: number;
}

export interface DeptCurrencyResult {
  businessDate: string;
  rows: DeptCurrencyRow[];
}

export async function queryDeptCurrency(businessDate: Date): Promise<DeptCurrencyResult> {
  const dateIso = toIso(businessDate);
  const start = dayStart(dateIso);

  const charges = await prisma.folioCharge.findMany({
    where: { businessDate: start },
    select: {
      amount: true,
      department: { select: { code: true, name: true } },
      revenueCode: { select: { department: { select: { code: true, name: true } } } },
    },
  });

  const dailyRates = await prisma.reservationDailyRate.findMany({
    where: { stayDate: start, currencyCode: { not: 'AZN' } },
    select: {
      amount: true,
      currencyCode: true,
      reservation: {
        select: { roomType: { select: { name: true } } },
      },
    },
  });

  const map = new Map<string, DeptCurrencyRow>();
  for (const c of charges) {
    const dept = c.department ?? c.revenueCode?.department;
    const code = dept?.code ?? 'OTHER';
    const name = dept?.name ?? 'Other';
    const k = `${code}|AZN`;
    const e = map.get(k) ?? { departmentCode: code, departmentName: name, currencyCode: 'AZN', total: 0 };
    e.total += Number(c.amount);
    map.set(k, e);
  }

  for (const dr of dailyRates) {
    const code = 'ROOM';
    const k = `${code}|${dr.currencyCode}`;
    const e = map.get(k) ?? { departmentCode: code, departmentName: 'Room', currencyCode: dr.currencyCode, total: 0 };
    e.total += Number(dr.amount);
    map.set(k, e);
  }

  const rows = [...map.values()].sort((a, b) => a.departmentCode.localeCompare(b.departmentCode));
  rows.forEach((r) => { r.total = Math.round(r.total * 100) / 100; });
  return { businessDate: dateIso, rows };
}

// ── discounts ──

export interface DiscountsRow {
  guestName: string;
  roomNumber: string | null;
  description: string;
  amount: number;
}

export interface DiscountsResult {
  businessDate: string;
  rows: DiscountsRow[];
  totalDiscount: number;
}

export async function queryDiscounts(businessDate: Date): Promise<DiscountsResult> {
  const dateIso = toIso(businessDate);
  const start = dayStart(dateIso);

  const charges = await prisma.folioCharge.findMany({
    where: {
      businessDate: start,
      amount: { lt: 0 },
    },
    select: {
      amount: true,
      description: true,
      folio: {
        select: {
          reservation: {
            select: {
              guest: { select: { fullName: true } },
              room: { select: { roomNumber: true } },
            },
          },
        },
      },
    },
  });

  const rows: DiscountsRow[] = charges.map((c) => ({
    guestName: c.folio.reservation.guest.fullName,
    roomNumber: c.folio.reservation.room?.roomNumber ?? null,
    description: c.description,
    amount: Math.abs(Number(c.amount)),
  }));

  return {
    businessDate: dateIso,
    rows,
    totalDiscount: rows.reduce((s, r) => s + r.amount, 0),
  };
}

// ── transferred-discounts ──

export interface TransferredDiscountsRow {
  fromDepartment: string;
  toDepartment: string;
  guestName: string;
  amount: number;
}

export interface TransferredDiscountsResult {
  businessDate: string;
  rows: TransferredDiscountsRow[];
  total: number;
}

export async function queryTransferredDiscounts(businessDate: Date): Promise<TransferredDiscountsResult> {
  const dateIso = toIso(businessDate);
  const start = dayStart(dateIso);

  const charges = await prisma.folioCharge.findMany({
    where: {
      businessDate: start,
      amount: { lt: 0 },
      description: { contains: 'transfer' },
    },
    select: {
      amount: true,
      department: { select: { code: true, name: true } },
      revenueCode: { select: { department: { select: { code: true, name: true } } } },
      folio: {
        select: {
          reservation: {
            select: { guest: { select: { fullName: true } } },
          },
        },
      },
    },
  });

  const rows: TransferredDiscountsRow[] = charges.map((c) => {
    const dept = c.department ?? c.revenueCode?.department;
    return {
      fromDepartment: dept?.name ?? 'Unknown',
      toDepartment: 'Transfer',
      guestName: c.folio.reservation.guest.fullName,
      amount: Math.abs(Number(c.amount)),
    };
  });

  return {
    businessDate: dateIso,
    rows,
    total: rows.reduce((s, r) => s + r.amount, 0),
  };
}

// ── dept-pivot ──

export interface DeptPivotRow {
  departmentCode: string;
  departmentName: string;
  revenueByCode: Record<string, number>;
  total: number;
}

export interface DeptPivotResult {
  businessDate: string;
  revenueCodes: { code: string; name: string }[];
  rows: DeptPivotRow[];
  grandTotal: number;
}

export async function queryDeptPivot(businessDate: Date): Promise<DeptPivotResult> {
  const dateIso = toIso(businessDate);
  const start = dayStart(dateIso);

  const charges = await prisma.folioCharge.findMany({
    where: { businessDate: start },
    select: {
      amount: true,
      department: { select: { code: true, name: true } },
      revenueCode: { select: { code: true, name: true, department: { select: { code: true, name: true } } } },
    },
  });

  const rcSet = new Map<string, string>();
  const deptMap = new Map<string, DeptPivotRow>();

  for (const c of charges) {
    const dept = c.department ?? c.revenueCode?.department;
    const deptCode = dept?.code ?? 'OTHER';
    const deptName = dept?.name ?? 'Other';
    const rcCode = c.revenueCode.code;
    const rcName = c.revenueCode.name;
    rcSet.set(rcCode, rcName);

    const row = deptMap.get(deptCode) ?? { departmentCode: deptCode, departmentName: deptName, revenueByCode: {}, total: 0 };
    row.revenueByCode[rcCode] = (row.revenueByCode[rcCode] ?? 0) + Number(c.amount);
    row.total += Number(c.amount);
    deptMap.set(deptCode, row);
  }

  const rows = [...deptMap.values()].sort((a, b) => a.departmentCode.localeCompare(b.departmentCode));
  rows.forEach((r) => {
    r.total = Math.round(r.total * 100) / 100;
    for (const k of Object.keys(r.revenueByCode)) {
      r.revenueByCode[k] = Math.round(r.revenueByCode[k] * 100) / 100;
    }
  });

  return {
    businessDate: dateIso,
    revenueCodes: [...rcSet.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code)),
    rows,
    grandTotal: rows.reduce((s, r) => s + r.total, 0),
  };
}
