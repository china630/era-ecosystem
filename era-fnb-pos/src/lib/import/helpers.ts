export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Stable uppercase code from a label (Elektraweb names -> PMS codes). */
export function slugCode(value: string): string {
  const s = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return (s || 'UNKNOWN').slice(0, 48);
}

export function cellString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

export function cellNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** EW money: `20,311.60` (thousands comma) or `111.10`. */
export function cellMoney(value: unknown): number | null {
  if (value == null || value === '') return null;
  const s = String(value).trim().replace(/\s/g, '');
  if (!s || /^nan$/i.test(s)) return null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    const n = Number(s.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return cellNumber(s);
}

export function cellBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

/** Excel 1900-system serial (Elektraweb). Keeps the time-of-day fraction. */
function fromExcelSerial(serial: number, dateOnly = false): Date | null {
  if (!Number.isFinite(serial)) return null;
  // ~1954-12 … 2119 — skips 0 / NAN leftovers and unix-ms mistaken as serial.
  if (serial < 20000 || serial > 80000) return null;
  const n = dateOnly ? Math.floor(serial) : serial;
  const utc = Date.UTC(1899, 11, 30) + n * 86400000;
  const d = new Date(utc);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseDateCell(value: unknown, opts?: { dateOnly?: boolean }): Date | null {
  const dateOnly = Boolean(opts?.dateOnly);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    if (!dateOnly) return value;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return fromExcelSerial(value, dateOnly);
  }
  const s = cellString(value);
  if (!s) return null;
  if (/^nan$/i.test(s) || s === "0") return null;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = fromExcelSerial(Number(s), dateOnly);
    if (serial) return serial;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** First non-empty string among alias keys (case-insensitive, including original Excel headers). */
export function firstCellString(raw: Record<string, unknown>, keys: string[]): string | null {
  const wanted = new Set(keys.map((k) => normalizeHeader(k)));
  for (const [key, val] of Object.entries(raw)) {
    if (!wanted.has(normalizeHeader(key))) continue;
    const s = cellString(val);
    if (s) return s;
  }
  return null;
}

export function mapHeaders(
  row: Record<string, unknown>,
  aliases: Record<string, string>,
): Record<string, unknown> {
  const aliasMap = new Map<string, string>();
  for (const [header, field] of Object.entries(aliases)) {
    aliasMap.set(normalizeHeader(header), field);
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    out[key] = val;
    const field = aliasMap.get(normalizeHeader(key));
    if (field) out[field] = val;
  }
  return out;
}

export async function upsertByCode<T extends { code: string }>(
  findUnique: (code: string) => Promise<{ id: string } | null>,
  upsertFn: () => Promise<unknown>,
  code: string,
  dryRun: boolean,
): Promise<'created' | 'updated'> {
  const existing = await findUnique(code);
  if (dryRun) return existing ? 'updated' : 'created';
  await upsertFn();
  return existing ? 'updated' : 'created';
}

export function mapRoomStatus(state: string | null | undefined): 'AVAILABLE' | 'DIRTY' | 'CLEAN' | 'OCCUPIED' {
  const s = (state ?? '').toLowerCase();
  if (s.includes('dirty')) return 'DIRTY';
  if (s.includes('clean')) return 'CLEAN';
  if (s.includes('occ')) return 'OCCUPIED';
  return 'AVAILABLE';
}

export function mapReservationStatus(state: string | null | undefined): 'CONFIRMED' | 'IN_HOUSE' | 'CHECKED_OUT' | 'CANCELLED' | 'OPTION' {
  const s = (state ?? '').toLowerCase().replace(/[\s_-]+/g, '');
  if (s.includes('cancel')) return 'CANCELLED';
  if (s.includes('checkout')) return 'CHECKED_OUT';
  if (s.includes('inhouse') || s === 'checkin' || s.includes('checkedin')) return 'IN_HOUSE';
  if (s.includes('option')) return 'OPTION';
  if (s.includes('reservation') || s.includes('definite') || s.includes('confirm')) return 'CONFIRMED';
  return 'CONFIRMED';
}
