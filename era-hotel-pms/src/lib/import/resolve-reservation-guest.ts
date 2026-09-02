import { composePersonFullName } from '@/lib/person-documents';
import type { ImportTx } from '@/lib/import/types';

/** In-memory index for one import batch — rebuilt on first reservation row. */
let lookupCache: Map<string, Set<string>> | null = null;

export type GuestLookupRow = {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  externalRef: string | null;
};

export type GuestCardRefRow = {
  externalRef: string;
  fullName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  /** Raw EW `Name` column (patronymic may be inside). */
  ewRawName?: string | null;
};

const SKIP_FOLDED = new Set([
  '999 fb',
  'cash folio',
  'balance',
  'test qonaqlar folyo',
]);

/** Audit parity (`audit-unmatched-guests.js`) — keeps Cyrillic + NFKC. */
function normNameForImport(value: string): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactFolded(folded: string): string {
  return folded.replace(/\s+/g, '');
}

export function normalizeGuestExternalRef(value: string | null | undefined): string | null {
  const s = String(value ?? '').trim();
  if (!s || s === 'NaN') return null;
  return s;
}

/** Canon §15.5 — keys for strict Name+LastName (and reverse) matching. */
export function guestIndexKeys(
  row: Pick<GuestLookupRow, 'fullName' | 'firstName' | 'lastName' | 'middleName'> & {
    ewRawName?: string | null;
  },
): string[] {
  const composed = composePersonFullName(row.firstName, row.middleName, row.lastName);
  const keys = new Set<string>();
  for (const raw of [
    composed,
    row.fullName,
    [row.firstName, row.lastName].filter(Boolean).join(' '),
    [row.lastName, row.firstName].filter(Boolean).join(' '),
    [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' '),
    [row.lastName, row.firstName, row.middleName].filter(Boolean).join(' '),
    row.ewRawName && row.lastName ? `${row.ewRawName} ${row.lastName}` : '',
    row.ewRawName && row.lastName ? `${row.lastName} ${row.ewRawName}` : '',
  ]) {
    if (!raw?.trim()) continue;
    const folded = normNameForImport(raw);
    if (!folded) continue;
    keys.add(folded);
    keys.add(compactFolded(folded));
  }
  return [...keys];
}

function addToLookup(map: Map<string, Set<string>>, keys: string[], value: string): void {
  for (const key of keys) {
    const bucket = map.get(key) ?? new Set<string>();
    bucket.add(value);
    map.set(key, bucket);
  }
}

/** Name keys → ERA Guest.id (UUID) for import against loaded Guest rows. */
export function buildGuestNameLookup(rows: GuestLookupRow[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    addToLookup(map, guestIndexKeys(row), row.id);
  }
  return map;
}

/** Name keys → Elektraweb Guest Id (`Guest.externalRef`) for xlsx enrich pre-import. */
export function buildGuestExternalRefLookup(rows: GuestCardRefRow[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    const ext = normalizeGuestExternalRef(row.externalRef);
    if (!ext) continue;
    addToLookup(map, guestIndexKeys(row), ext);
  }
  return map;
}

/** Split FO `Guest Name` (`A / B / C`) and drop house/system labels. */
export function splitReservationGuestParts(guestName: string | null | undefined): string[] {
  const parts = String(guestName ?? '')
    .split(/\s*\/\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      const f = normNameForImport(p);
      return f.length >= 3 && !SKIP_FOLDED.has(f) && !f.startsWith('cancelfolio');
    });
  if (parts.length > 0) return parts;
  const whole = String(guestName ?? '').trim();
  if (!whole) return [];
  const f = normNameForImport(whole);
  if (f.length >= 3 && !SKIP_FOLDED.has(f)) return [whole];
  return [];
}

function lookupExact(part: string, lookup: Map<string, Set<string>>): Set<string> | null {
  const folded = normNameForImport(part);
  if (!folded) return null;
  const hit = lookup.get(folded) ?? lookup.get(compactFolded(folded));
  return hit?.size ? hit : null;
}

/** Safe fold only: compact equality + prefix (EW clipped names). No initials / Levenshtein. */
function lookupSafeFold(part: string, lookup: Map<string, Set<string>>): Set<string> | null {
  const folded = normNameForImport(part);
  if (!folded) return null;
  const cp = compactFolded(folded);
  if (cp.length < 6) return null;

  const hits = new Set<string>();
  for (const [key, ids] of lookup) {
    const ck = key.includes(' ') ? compactFolded(key) : key;
    if (ck.length < 6) continue;
    if (ck === cp || ck.startsWith(cp) || cp.startsWith(ck)) {
      for (const id of ids) hits.add(id);
    }
  }
  if (hits.size === 1) return hits;
  return null;
}

function pickUniqueId(ids: Set<string> | null): string | null {
  if (!ids || ids.size !== 1) return null;
  return [...ids][0] ?? null;
}

/** Match one FO name fragment (`Guest Name` part) to a single Guest.id. */
export function resolveGuestIdForNamePart(
  part: string,
  lookup: Map<string, Set<string>>,
): string | null {
  return (
    pickUniqueId(lookupExact(part, lookup)) ?? pickUniqueId(lookupSafeFold(part, lookup))
  );
}

export type PlannedImportPaxRow = {
  guestId: string | null;
  displayName: string;
  isPrimary: boolean;
  sortOrder: number;
};

/**
 * Build party rows from split `Guest Name` parts.
 * Primary guest is always `primaryGuestId` (from Guest Id column / import resolver).
 */
export function planReservationPaxFromParts(
  parts: string[],
  primaryGuestId: string,
  lookup: Map<string, Set<string>>,
): PlannedImportPaxRow[] {
  if (!parts.length) {
    return [
      {
        guestId: primaryGuestId,
        displayName: '',
        isPrimary: true,
        sortOrder: 0,
      },
    ];
  }

  const partIds = parts.map((part) => resolveGuestIdForNamePart(part, lookup));
  let primaryIdx = partIds.findIndex((id) => id === primaryGuestId);
  if (primaryIdx < 0) primaryIdx = 0;
  partIds[primaryIdx] = primaryGuestId;

  const seenGuestIds = new Set<string>();
  const rows: PlannedImportPaxRow[] = [];
  for (let i = 0; i < parts.length; i++) {
    const guestId = partIds[i] ?? null;
    if (guestId) {
      if (seenGuestIds.has(guestId)) continue;
      seenGuestIds.add(guestId);
    }
    rows.push({
      guestId,
      displayName: parts[i] ?? '',
      isPrimary: i === primaryIdx,
      sortOrder: rows.length,
    });
  }

  if (!rows.some((r) => r.isPrimary)) {
    rows.unshift({
      guestId: primaryGuestId,
      displayName: parts[primaryIdx] ?? '',
      isPrimary: true,
      sortOrder: 0,
    });
    return rows.map((row, i) => ({ ...row, sortOrder: i }));
  }

  return rows;
}

function resolveUniqueFromLookup(
  guestName: string | null | undefined,
  lookup: Map<string, Set<string>>,
): string | null {
  const parts = splitReservationGuestParts(guestName);
  if (!parts.length) return null;

  const matched = new Set<string>();
  for (const part of parts) {
    const id =
      pickUniqueId(lookupExact(part, lookup)) ?? pickUniqueId(lookupSafeFold(part, lookup));
    if (id) matched.add(id);
  }

  if (matched.size === 1) return [...matched][0] ?? null;
  return null;
}

/** Match reservation `Guest Name` to imported Guest.id (UUID). */
export function resolveGuestIdFromName(
  guestName: string | null | undefined,
  lookup: Map<string, Set<string>>,
): string | null {
  return resolveUniqueFromLookup(guestName, lookup);
}

/** Match reservation `Guest Name` to Elektraweb Guest Id for xlsx enrich. */
export function resolveGuestExternalRefFromName(
  guestName: string | null | undefined,
  lookup: Map<string, Set<string>>,
): string | null {
  return resolveUniqueFromLookup(guestName, lookup);
}

export function resetReservationGuestLookupCache(): void {
  lookupCache = null;
}

async function ensureGuestLookup(tx: ImportTx): Promise<Map<string, Set<string>>> {
  if (lookupCache) return lookupCache;
  const rows = await tx.guest.findMany({
    select: {
      id: true,
      fullName: true,
      firstName: true,
      lastName: true,
      middleName: true,
      externalRef: true,
    },
  });
  lookupCache = buildGuestNameLookup(rows);
  return lookupCache;
}

/** Shared name index for reservation import (cached per batch). */
export async function getGuestImportNameLookup(tx: ImportTx): Promise<Map<string, Set<string>>> {
  return ensureGuestLookup(tx);
}

/**
 * Resolve guest for reservation import.
 * 1) Elektraweb Guest Id column → Guest.externalRef (required path — no duplicate stubs).
 * 2) Name match against imported Guest Cards when Guest Id cell empty.
 */
export async function resolveGuestIdForReservationImport(
  tx: ImportTx,
  input: {
    guestExternalRef?: string | null;
    guestName?: string | null;
    reservationExternalRef: string;
  },
): Promise<string> {
  const guestExt = normalizeGuestExternalRef(input.guestExternalRef);
  if (guestExt) {
    const byRef = await tx.guest.findFirst({ where: { externalRef: guestExt } });
    if (byRef) return byRef.id;
    throw new Error(
      `Guest Id ${guestExt} not found (Res ${input.reservationExternalRef}). Import Guest Cards (step 10) first.`,
    );
  }

  const lookup = await ensureGuestLookup(tx);
  const matched = resolveGuestIdFromName(input.guestName, lookup);
  if (matched) return matched;

  const label = input.guestName?.trim() || '(empty Guest Name)';
  throw new Error(
    `Res ${input.reservationExternalRef}: missing Guest Id and no Guest Card match for "${label}". Run scripts/enrich-reservations-guest-id.ts on 11-Reservations.xlsx.`,
  );
}
