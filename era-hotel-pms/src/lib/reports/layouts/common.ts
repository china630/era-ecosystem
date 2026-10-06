import type { LayoutCell, LayoutColumn, LayoutFormat, LayoutRow, LayoutSection } from '../layout';
import { row } from '../layout';
import { safeDiv, safePct } from '../ratio';

export interface LayoutCtx {
  t: (key: string) => string;
  locale: string;
  from: string;
  to: string;
}

export function colLabel(ctx: LayoutCtx, key: string): string {
  return ctx.t(`reportsPdf.col.${key}`);
}

export function secTitle(ctx: LayoutCtx, key: string): string {
  return ctx.t(`reportsPdf.sec.${key}`);
}

/** Enum-like values (payment methods, flags) with a translated label when one exists. */
export function valueLabel(ctx: LayoutCtx, group: string, value: string | null | undefined): string {
  if (!value) return '';
  const key = `reportsPdf.val.${group}.${value}`;
  const out = ctx.t(key);
  return out === key ? value : out;
}

export function col(
  ctx: LayoutCtx,
  key: string,
  format: LayoutFormat = 'text',
  weight = 1,
  label?: string,
): LayoutColumn {
  return { key, label: label ?? colLabel(ctx, key), format, weight };
}

export function section(id: string, columns: LayoutColumn[], rows: LayoutRow[], title?: string): LayoutSection {
  return title ? { id, title, columns, rows } : { id, columns, rows };
}

export function sum<T>(items: T[], pick: (item: T) => number | null | undefined): number {
  return Math.round(items.reduce((s, i) => s + (pick(i) ?? 0), 0) * 100) / 100;
}

export function totalRow(ctx: LayoutCtx, cells: LayoutCell[]): LayoutRow {
  return row([colLabel(ctx, 'total'), ...cells], 'total');
}

export { row, safeDiv, safePct };

export const MONTH_KEYS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] as const;

export function monthLabel(ctx: LayoutCtx, month: string): string {
  const m = Number(month.slice(-2));
  const year = month.length > 2 ? Number(month.slice(0, 4)) : 2000;
  const name = new Intl.DateTimeFormat(ctx.locale || 'az', { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, m - 1, 15)),
  );
  return month.length > 2 ? `${name} ${year}` : name;
}

/** `pivot(rows, r => r.agencyName, r => r.month, r => r.roomNights)` → sorted keys and a value lookup. */
export function pivot<T>(
  items: T[],
  rowKey: (item: T) => string,
  colKey: (item: T) => string,
  value: (item: T) => number | null,
): { rowKeys: string[]; colKeys: string[]; get: (r: string, c: string) => number | null } {
  const cells = new Map<string, number | null>();
  const rowKeys = new Set<string>();
  const colKeys = new Set<string>();
  for (const item of items) {
    const r = rowKey(item);
    const c = colKey(item);
    rowKeys.add(r);
    colKeys.add(c);
    const k = `${r}\u0000${c}`;
    const v = value(item);
    const prev = cells.get(k);
    cells.set(k, v == null ? (prev ?? null) : (prev ?? 0) + v);
  }
  return {
    rowKeys: [...rowKeys].sort((a, b) => a.localeCompare(b)),
    colKeys: [...colKeys].sort((a, b) => a.localeCompare(b)),
    get: (r, c) => cells.get(`${r}\u0000${c}`) ?? null,
  };
}

/** Matrix section with a row total column and a total row (sums). */
export function matrixSection(
  ctx: LayoutCtx,
  id: string,
  title: string | undefined,
  firstColumn: LayoutColumn,
  data: ReturnType<typeof pivot>,
  format: LayoutFormat,
  colHeader: (key: string) => string = (k) => k,
  withTotals = true,
): LayoutSection {
  const columns: LayoutColumn[] = [
    firstColumn,
    ...data.colKeys.map((k) => ({ key: k, label: colHeader(k), format })),
    ...(withTotals ? [col(ctx, 'total', format)] : []),
  ];
  const rows: LayoutRow[] = data.rowKeys.map((r) => {
    const values = data.colKeys.map((c) => data.get(r, c));
    return row([r, ...values.map((v) => v ?? ''), ...(withTotals ? [sum(values, (v) => v)] : [])]);
  });
  if (withTotals && rows.length > 0) {
    const colTotals = data.colKeys.map((c) => sum(data.rowKeys, (r) => data.get(r, c)));
    rows.push(totalRow(ctx, [...colTotals, sum(colTotals, (v) => v)]));
  }
  return section(id, columns, rows, title);
}
