import { mapReservationStatus } from '@/lib/import/helpers';

/** Elektraweb RESSTATEID → ERA status (confirmed from HAR). */
export function mapElektrawebReservationStatus(row: Record<string, unknown>): {
  status: 'CONFIRMED' | 'IN_HOUSE' | 'CHECKED_OUT' | 'CANCELLED' | 'OPTION';
  resStateId: number | null;
  resState: string | null;
} {
  const resStateId = row.RESSTATEID != null ? Number(row.RESSTATEID) : null;
  const resState = row.RESSTATE != null ? String(row.RESSTATE) : null;

  if (resStateId === 3) return { status: 'IN_HOUSE', resStateId, resState };
  if (resStateId === 4) return { status: 'CHECKED_OUT', resStateId, resState };
  if (resStateId === 2) return { status: 'CONFIRMED', resStateId, resState };

  // Cancelled / unknown — fall back to string mapper (InHouse without space fixed there)
  const fromLabel = mapReservationStatus(resState);
  return { status: fromLabel, resStateId, resState };
}

export function parseElektrawebDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const s = String(value).trim();
  // "2026-07-15 14:00:00.000" — treat naive local wall time as Asia/Baku.
  const m = s.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/,
  );
  if (m) {
    const [, ymd, hh, mm, ss = '00'] = m;
    const d = new Date(`${ymd}T${hh}:${mm}:${ss}.000+04:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(normalized);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

export function str(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

export function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
