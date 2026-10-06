import { prisma } from '@/lib/prisma';
import { civilDay, civilWindow, ymdParam } from '@/lib/reports/civil-days';

function toIso(d: Date): string {
  return ymdParam(d);
}

function dayWhere(iso: string): { gte: Date; lt: Date } {
  return civilWindow(iso, iso);
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
  const day = dayWhere(dateIso);

  const payments = await prisma.folioPayment.findMany({
    where: {
      kind: 'PAYMENT',
      createdAt: day,
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
  const window = civilWindow(toIso(from), toIso(to));

  const charges = await prisma.folioCharge.findMany({
    where: { businessDate: window },
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
    const dateStr = civilDay(c.businessDate);

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
  const day = dayWhere(dateIso);

  const charges = await prisma.folioCharge.findMany({
    where: { businessDate: day },
    select: {
      amount: true,
      department: { select: { code: true, name: true } },
      revenueCode: { select: { department: { select: { code: true, name: true } } } },
    },
  });

  const dailyRates = await prisma.reservationDailyRate.findMany({
    where: { stayDate: day, currencyCode: { not: 'AZN' } },
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
  const day = dayWhere(dateIso);

  const charges = await prisma.folioCharge.findMany({
    where: {
      businessDate: day,
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
  const day = dayWhere(dateIso);

  const charges = await prisma.folioCharge.findMany({
    where: {
      businessDate: day,
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
  const day = dayWhere(dateIso);

  const charges = await prisma.folioCharge.findMany({
    where: { businessDate: day },
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
