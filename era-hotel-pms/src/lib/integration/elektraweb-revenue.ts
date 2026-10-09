import type { ImportTx } from '@/lib/import/types';

/**
 * One Elektraweb revenue resolver for the Excel import (`03-Revenue-Codes`) and the live folio bridge.
 * Known Elektra names map onto the codes our services post to (`ROOM`, `BANQUET`, …); anything else
 * keeps its own Elektra code. `ROOM` is the fallback only when Elektra sent neither code nor name.
 * Catalogs that kept the numeric department (`code` 10, `name` ROOM) are still the room charge:
 * `findRevenueCodeByToken` matches the token on code first, then on name.
 */

export type ElektraRevenueInput = {
  /** Elektra revenue code text (Excel `Code`, bridge `REVCODE`). */
  code?: string | null;
  /** Elektra numeric revenue id (bridge `REVID`) — used only when no code text is present. */
  numericId?: number | string | null;
  /** Elektra revenue name (Excel `Revenue Name`, bridge `REVENUE` / `REVID_REVENUENAME`). */
  name?: string | null;
};

export type ElektraRevenueTarget = {
  code: string;
  /** Name to write when the row is created. */
  name: string;
  /** True when the target is a code our services post to by literal code. */
  canonical: boolean;
  /** True when Elektra sent neither code nor name. */
  fallback: boolean;
};

type KnownRevenue = { code: string; defaultName: string; names: RegExp; codes?: RegExp };

const KNOWN_REVENUES: readonly KnownRevenue[] = [
  {
    code: 'ROOM',
    defaultName: 'Room',
    names: /^(room|rooms|room revenue|room charge|accommodation|lodging|konaklama|oda|oda geliri|otaq|otaq gəliri|проживание)$/i,
    codes: /^(room|oda|konaklama)$/i,
  },
  {
    code: 'BANQUET',
    defaultName: 'Banquet',
    names: /(banquet|banket|ziyafet|ziyafət|банкет)/i,
    codes: /^(banquet|banket|bnq|bqt)$/i,
  },
  {
    code: 'MINIBAR',
    defaultName: 'Minibar',
    names: /^mini[\s-]?bar$/i,
    codes: /^(minibar|mini[\s-]?bar|mb)$/i,
  },
  {
    code: 'LAUNDRY',
    defaultName: 'Laundry',
    names: /^(laundry|çamaşır|camasir|paltaryuma|прачечная)$/i,
    codes: /^(laundry|lnd)$/i,
  },
];

const ROOM_FALLBACK = { code: 'ROOM', defaultName: 'Room' } as const;

function clean(value: string | null | undefined): string | null {
  const t = value?.replace(/\s+/g, ' ').trim();
  return t ? t : null;
}

function slugCode(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36);
  return slug || 'REV';
}

export function matchKnownElektraRevenue(input: ElektraRevenueInput): KnownRevenue | null {
  const name = clean(input.name);
  const code = clean(input.code);
  for (const known of KNOWN_REVENUES) {
    if (name && known.names.test(name)) return known;
    if (code && (code.toUpperCase() === known.code || known.codes?.test(code))) return known;
  }
  return null;
}

/** Pure mapping Elektra code/name → our revenue code (no DB). */
export function elektraRevenueTarget(input: ElektraRevenueInput): ElektraRevenueTarget {
  const name = clean(input.name);
  const code = clean(input.code);
  const numericRaw = input.numericId == null ? null : clean(String(input.numericId));

  const known = matchKnownElektraRevenue(input);
  if (known) {
    return { code: known.code, name: name ?? known.defaultName, canonical: true, fallback: false };
  }
  if (code) {
    return { code: code.toUpperCase(), name: name ?? code, canonical: false, fallback: false };
  }
  if (numericRaw) {
    return { code: `EW-${numericRaw}`, name: name ?? `Elektraweb ${numericRaw}`, canonical: false, fallback: false };
  }
  if (name) {
    return { code: `EW-${slugCode(name)}`, name, canonical: false, fallback: false };
  }
  return { code: ROOM_FALLBACK.code, name: ROOM_FALLBACK.defaultName, canonical: true, fallback: true };
}

type RevenueDb = Pick<ImportTx, 'revenueCode'>;

/**
 * Bridge path: find the revenue code for an Elektra folio line, creating our row when missing.
 * Order: known rule → exact Elektra name → code (`X` / `EW-X`) → create own code.
 */
export async function resolveElektraRevenueCodeId(
  db: RevenueDb,
  input: ElektraRevenueInput,
): Promise<string>;
export async function resolveElektraRevenueCodeId(
  db: RevenueDb,
  input: ElektraRevenueInput,
  options: { createMissing: false },
): Promise<string | null>;
export async function resolveElektraRevenueCodeId(
  db: RevenueDb,
  input: ElektraRevenueInput,
  options: { createMissing?: boolean } = {},
): Promise<string | null> {
  const createMissing = options.createMissing !== false;
  const target = elektraRevenueTarget(input);
  const name = clean(input.name);
  const code = clean(input.code);
  const numericRaw = input.numericId == null ? null : clean(String(input.numericId));

  if (!target.canonical) {
    if (name) {
      const byName = await db.revenueCode.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (byName) return byName.id;
    }
    const candidates = [target.code, code, numericRaw, numericRaw ? `EW-${numericRaw}` : null].filter(
      (c): c is string => !!c,
    );
    for (const candidate of [...new Set(candidates)]) {
      const byCode = await db.revenueCode.findFirst({
        where: { code: { equals: candidate, mode: 'insensitive' } },
        select: { id: true },
      });
      if (byCode) return byCode.id;
    }
  }

  if (!createMissing) {
    const found = await db.revenueCode.findFirst({ where: { code: target.code }, select: { id: true } });
    return found?.id ?? null;
  }

  const row = await db.revenueCode.upsert({
    where: { code: target.code } as never,
    create: { code: target.code, name: target.name } as never,
    update: {},
    select: { id: true },
  });
  return row.id;
}

/** Import path: upsert one `03-Revenue-Codes` row under the resolved code; only `name` / `taxTag` are written. */
export async function upsertElektraRevenueCode(
  db: RevenueDb,
  row: { code: string; name: string; taxTag?: string | null },
  dryRun: boolean,
): Promise<'created' | 'updated'> {
  const target = elektraRevenueTarget({ code: row.code, name: row.name });
  const existing = await db.revenueCode.findFirst({ where: { code: target.code }, select: { id: true } });
  if (dryRun) return existing ? 'updated' : 'created';
  await db.revenueCode.upsert({
    where: { code: target.code } as never,
    create: { code: target.code, name: row.name, taxTag: row.taxTag ?? undefined } as never,
    update: { name: row.name, taxTag: row.taxTag ?? undefined },
  });
  return existing ? 'updated' : 'created';
}
