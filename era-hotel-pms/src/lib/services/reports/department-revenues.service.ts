import { monthStartYmd, round2, splitGross, yearStartYmd, ymdParam } from '@/lib/reports/civil-days';
import { loadChargeDays, loadRevenueCodes } from './stay-ledger';

export type RevenuePeriodKey = 'today' | 'month' | 'year';

export interface RevenueAmounts {
  gross: number;
  net: number;
  vat: number;
}

export interface DepartmentRevenueLine {
  code: string;
  name: string;
  today: RevenueAmounts;
  month: RevenueAmounts;
  year: RevenueAmounts;
}

export interface DepartmentRevenueGroup extends DepartmentRevenueLine {
  codes: DepartmentRevenueLine[];
}

export interface DepartmentRevenuesResult {
  businessDate: string;
  departments: DepartmentRevenueGroup[];
  total: Pick<DepartmentRevenueLine, 'today' | 'month' | 'year'>;
}

const zero = (): RevenueAmounts => ({ gross: 0, net: 0, vat: 0 });
const emptyLine = (code: string, name: string): DepartmentRevenueLine => ({
  code,
  name,
  today: zero(),
  month: zero(),
  year: zero(),
});

function add(target: RevenueAmounts, part: RevenueAmounts): void {
  target.gross += part.gross;
  target.net += part.net;
  target.vat += part.vat;
}

function roundAmounts(a: RevenueAmounts): RevenueAmounts {
  return { gross: round2(a.gross), net: round2(a.net), vat: round2(a.vat) };
}

function roundLine<T extends DepartmentRevenueLine>(line: T): T {
  return { ...line, today: roundAmounts(line.today), month: roundAmounts(line.month), year: roundAmounts(line.year) };
}

/** Elektra Department Revenues: Today / Month to date / Year to date, each split Total / Net / Tax. */
export async function queryDepartmentRevenues(
  _fromParam: string | Date,
  toParam: string | Date,
): Promise<DepartmentRevenuesResult> {
  const anchor = ymdParam(toParam);
  const monthStart = monthStartYmd(anchor);
  const yearStart = yearStartYmd(anchor);
  const [chargeDays, codes] = await Promise.all([loadChargeDays(yearStart, anchor), loadRevenueCodes()]);

  const deptMap = new Map<string, DepartmentRevenueGroup>();
  const total = { today: zero(), month: zero(), year: zero() };
  for (const c of chargeDays) {
    const code = codes.get(c.revenueCodeId);
    const split = splitGross(c.gross, code?.vatRate ?? 0);
    const deptCode = code?.departmentCode ?? 'OTHER';
    const dept = deptMap.get(deptCode) ?? { ...emptyLine(deptCode, code?.departmentName ?? 'Other'), codes: [] };
    const rcCode = code?.code ?? c.revenueCodeId;
    let line = dept.codes.find((l) => l.code === rcCode);
    if (!line) {
      line = emptyLine(rcCode, code?.name ?? rcCode);
      dept.codes.push(line);
    }
    const periods: RevenuePeriodKey[] = ['year'];
    if (c.day >= monthStart) periods.push('month');
    if (c.day === anchor) periods.push('today');
    for (const p of periods) {
      add(dept[p], split);
      add(line[p], split);
      add(total[p], split);
    }
    deptMap.set(deptCode, dept);
  }

  const departments = [...deptMap.values()]
    .map((d) => ({ ...roundLine(d), codes: d.codes.map(roundLine).sort((a, b) => a.code.localeCompare(b.code)) }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return {
    businessDate: anchor,
    departments,
    total: { today: roundAmounts(total.today), month: roundAmounts(total.month), year: roundAmounts(total.year) },
  };
}
