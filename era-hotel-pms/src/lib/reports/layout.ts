import { NO_RATIO } from './ratio';

/**
 * One table model for screen, PDF and Excel. Builders resolve labels; renderers only draw.
 * `null` in pct / money ratio columns means "no denominator" and prints an em dash.
 */

export type LayoutCell = string | number | null;

export type LayoutFormat = 'text' | 'int' | 'money' | 'pct' | 'date' | 'datetime';

export interface LayoutColumn {
  key: string;
  label: string;
  format?: LayoutFormat;
  align?: 'left' | 'right' | 'center';
  /** Relative width (default 1). */
  weight?: number;
}

export type LayoutRowKind = 'data' | 'group' | 'subtotal' | 'total';

export interface LayoutRow {
  kind?: LayoutRowKind;
  cells: LayoutCell[];
  /** KPI rows: overrides the format of every non-text column in this row. */
  format?: LayoutFormat;
}

export interface LayoutSection {
  id: string;
  title?: string;
  columns: LayoutColumn[];
  rows: LayoutRow[];
}

export interface ReportLayout {
  slug: string;
  sections: LayoutSection[];
}

const NUMERIC: LayoutFormat[] = ['int', 'money', 'pct'];

export function columnAlign(col: LayoutColumn): 'left' | 'right' | 'center' {
  if (col.align) return col.align;
  const format = col.format ?? 'text';
  if (NUMERIC.includes(format)) return 'right';
  if (format === 'date' || format === 'datetime') return 'center';
  return 'left';
}

function formatNumber(value: number, digits: number, locale: string): string {
  const rounded = Math.abs(value) < 0.5 / 10 ** digits ? 0 : value;
  return new Intl.NumberFormat(locale || 'az', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rounded);
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}))?/;

/** `YYYY-MM-DD[ HH:MM]` → `DD.MM.YYYY[ HH:MM]` for date columns; other strings pass through. */
export function formatLayoutText(value: string, format: LayoutFormat | undefined): string {
  if (format !== 'date' && format !== 'datetime') return value;
  return value.replace(ISO_DAY, (_m, y: string, mo: string, d: string, hm?: string) =>
    hm ? `${d}.${mo}.${y} ${hm}` : `${d}.${mo}.${y}`,
  );
}

/** Display text for a cell; Excel keeps raw numbers and uses `excelNumFmt`. */
export function formatLayoutCell(value: LayoutCell, format: LayoutFormat | undefined, locale: string): string {
  const f = format ?? 'text';
  if (value == null) return f === 'pct' || f === 'money' ? NO_RATIO : '';
  if (typeof value === 'string') return formatLayoutText(value, f);
  if (!Number.isFinite(value)) return NO_RATIO;
  switch (f) {
    case 'int':
      return formatNumber(value, 0, locale);
    case 'money':
      return formatNumber(value, 2, locale);
    case 'pct':
      return `${formatNumber(value, 1, locale)}%`;
    default:
      return String(value);
  }
}

export function excelNumFmt(format: LayoutFormat | undefined): string | undefined {
  switch (format) {
    case 'int':
      return '#,##0';
    case 'money':
      return '#,##0.00';
    case 'pct':
      return '0.0"%"';
    default:
      return undefined;
  }
}

export function cellFormat(row: LayoutRow, col: LayoutColumn): LayoutFormat {
  const base = col.format ?? 'text';
  return row.format && base !== 'text' ? row.format : base;
}

export function isEmphasisRow(row: LayoutRow): boolean {
  return row.kind === 'group' || row.kind === 'subtotal' || row.kind === 'total';
}

/** Short helpers for builders. */
export const row = (cells: LayoutCell[], kind: LayoutRowKind = 'data', format?: LayoutFormat): LayoutRow =>
  format ? { kind, cells, format } : { kind, cells };

export function layoutHasRows(layout: ReportLayout): boolean {
  return layout.sections.some((s) => s.rows.length > 0);
}
