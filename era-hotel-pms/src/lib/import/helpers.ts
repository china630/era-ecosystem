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

export function cellBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

export function parseDateCell(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const s = cellString(value);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
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
  const s = (state ?? '').toLowerCase();
  if (s.includes('cancel')) return 'CANCELLED';
  if (s.includes('check') && s.includes('out')) return 'CHECKED_OUT';
  if (s.includes('in house') || s.includes('in_house')) return 'IN_HOUSE';
  if (s.includes('option')) return 'OPTION';
  return 'CONFIRMED';
}
