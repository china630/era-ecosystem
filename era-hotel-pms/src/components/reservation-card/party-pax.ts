import { paxHasRealName } from '@/lib/reservation-names';
import { GUEST_FIN_DOC_TYPES } from '@/lib/guest-list-identity';
import type { PaxRow } from './types';

/** Party row with no display name — fillable slot (may still have guestId from TBA/hold). */
export function isMinorPax(row: Pick<PaxRow, 'birthDate' | 'age'>): boolean {
  const fromDob = row.birthDate ? Number(ageYearsFromBirthDate(row.birthDate)) : NaN;
  const age = Number.isFinite(fromDob) && row.birthDate ? fromDob : Number(row.age);
  return Number.isFinite(age) && age >= 0 && age < 18;
}

export function isIncompletePax(row: Pick<PaxRow, 'firstName' | 'lastName'>): boolean {
  return !paxHasRealName(row);
}

export function splitFullName(label: string): { firstName: string; lastName: string } {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function emptyPax(partial?: Partial<PaxRow>): PaxRow {
  return {
    title: '',
    sex: '',
    middleName: '',
    firstName: '',
    lastName: '',
    nationality: '',
    birthDate: '',
    age: '',
    idCardNo: '',
    passportNo: '',
    memberNo: '',
    payStatus: '',
    externalResId: '',
    guestState: '',
    isPrimary: false,
    ownsFolio: false,
    medicalPackageCode: '',
    ...partial,
  };
}

export function partySizeFromCounts(input: {
  adults: number;
  children11_6: number;
  children5_2: number;
  children1_0: number;
}): number {
  const adults = Math.max(0, input.adults || 0);
  const children =
    Math.max(0, input.children11_6 || 0) +
    Math.max(0, input.children5_2 || 0) +
    Math.max(0, input.children1_0 || 0);
  return adults + children;
}

/** Pad incomplete slots or trim trailing incomplete rows to match party size. Named rows are never dropped. */
export function syncPaxToPartySize(
  pax: PaxRow[],
  target: number,
  equalMode: boolean,
): PaxRow[] {
  const size = Math.max(0, target);
  let next = [...pax];

  while (next.length < size) {
    const isFirst = next.length === 0;
    next.push(
      emptyPax({
        isPrimary: isFirst && !equalMode,
        ownsFolio: equalMode || isFirst,
      }),
    );
  }

  while (next.length > size) {
    const last = next[next.length - 1];
    if (!last || !isIncompletePax(last)) break;
    next = next.slice(0, -1);
  }

  if (next.length === 0) return next;

  if (equalMode) {
    return next.map((row) => ({ ...row, isPrimary: false, ownsFolio: true }));
  }

  const primaryIdx = next.findIndex((r) => r.isPrimary);
  const keep = primaryIdx >= 0 ? primaryIdx : 0;
  return next.map((row, i) => ({
    ...row,
    isPrimary: i === keep,
    ownsFolio: i === keep,
  }));
}

export type PaxAgeBand = 'adult' | 'c11' | 'c5' | 'c1';

export type PartyCounts = {
  adults: number;
  children11_6: number;
  children5_2: number;
  children1_0: number;
};

/** Empty-slot age so the band survives a reload. Adults stay blank. */
const SLOT_AGE: Record<PaxAgeBand, string> = {
  adult: '',
  c11: '8',
  c5: '4',
  c1: '0',
};

export function paxAgeYears(row: Pick<PaxRow, 'birthDate' | 'age'>): number | null {
  const fromDob = row.birthDate ? Number(ageYearsFromBirthDate(row.birthDate)) : NaN;
  if (row.birthDate && Number.isFinite(fromDob)) return fromDob;
  const typed = Number(row.age);
  if (row.age !== '' && row.age != null && Number.isFinite(typed)) return typed;
  return null;
}

/** Hotel bands, same cut as depart-guest: 12 and older are adults. */
export function bandFromAge(age: number): PaxAgeBand {
  if (age >= 12) return 'adult';
  if (age >= 6) return 'c11';
  if (age >= 2) return 'c5';
  return 'c1';
}

function isLivePax(row: { departedAt?: string | null }): boolean {
  return !row.departedAt;
}

/** Birth date wins. A blank age is an adult slot. */
export function paxBand(row: Pick<PaxRow, 'birthDate' | 'age'>): PaxAgeBand {
  const years = paxAgeYears(row);
  if (years == null) return 'adult';
  return bandFromAge(years);
}

function countOf(counts: PartyCounts, band: PaxAgeBand): number {
  if (band === 'adult') return counts.adults;
  if (band === 'c11') return counts.children11_6;
  if (band === 'c5') return counts.children5_2;
  return counts.children1_0;
}

export function countsFromPax(
  pax: Array<Pick<PaxRow, 'birthDate' | 'age' | 'departedAt'>>,
): PartyCounts {
  const counts: PartyCounts = {
    adults: 0,
    children11_6: 0,
    children5_2: 0,
    children1_0: 0,
  };
  for (const row of pax) {
    if (!isLivePax(row)) continue;
    const band = paxBand(row);
    if (band === 'adult') counts.adults += 1;
    else if (band === 'c11') counts.children11_6 += 1;
    else if (band === 'c5') counts.children5_2 += 1;
    else counts.children1_0 += 1;
  }
  return counts;
}

export function bandForBirthDate(birthDate: string | undefined): PaxAgeBand {
  const years = birthDate ? Number(ageYearsFromBirthDate(birthDate)) : NaN;
  if (birthDate && Number.isFinite(years)) return bandFromAge(years);
  return 'adult';
}

/** A guest with no birth date can fill any slot. A known age must match the slot band. */
export function guestFitsSlot(
  birthDate: string | undefined | null,
  slot: Pick<PaxRow, 'birthDate' | 'age'>,
): boolean {
  const dob = (birthDate ?? '').trim();
  if (!dob) return true;
  return bandForBirthDate(dob) === paxBand(slot);
}

/**
 * Stamp empty unnamed slots from the saved counters.
 * Named rows and rows that already have a birth date or age are left alone.
 */
export function stampEmptySlotsFromCounts(pax: PaxRow[], counts: PartyCounts): PaxRow[] {
  const claimed: Record<PaxAgeBand, number> = { adult: 0, c11: 0, c5: 0, c1: 0 };
  for (const row of pax) {
    if (!isLivePax(row)) continue;
    if (paxAgeYears(row) == null && isIncompletePax(row)) continue;
    claimed[paxBand(row)] += 1;
  }
  const leftover: PaxAgeBand[] = [];
  (['adult', 'c11', 'c5', 'c1'] as const).forEach((band) => {
    const need = Math.max(0, countOf(counts, band) - claimed[band]);
    for (let i = 0; i < need; i++) leftover.push(band);
  });
  let cursor = 0;
  return pax.map((row) => {
    if (paxAgeYears(row) != null || !isIncompletePax(row)) return row;
    const band = leftover[cursor++] ?? 'adult';
    return { ...row, age: SLOT_AGE[band] };
  });
}

/** Add or drop empty slots per band. Named rows are never removed. */
export function syncPaxToBandCounts(
  pax: PaxRow[],
  counts: PartyCounts,
  equalMode: boolean,
): PaxRow[] {
  const target: PartyCounts = {
    adults: Math.max(0, counts.adults || 0),
    children11_6: Math.max(0, counts.children11_6 || 0),
    children5_2: Math.max(0, counts.children5_2 || 0),
    children1_0: Math.max(0, counts.children1_0 || 0),
  };
  let next = [...pax];
  for (const band of ['adult', 'c11', 'c5', 'c1'] as const) {
    const want = countOf(target, band);
    let have = next.filter((row) => isLivePax(row) && paxBand(row) === band).length;
    while (have < want) {
      const isFirst = next.length === 0;
      next.push(
        emptyPax({
          age: SLOT_AGE[band],
          isPrimary: isFirst && !equalMode,
          ownsFolio: equalMode || isFirst,
        }),
      );
      have += 1;
    }
    while (have > want) {
      let idx = -1;
      for (let i = next.length - 1; i >= 0; i--) {
        if (isLivePax(next[i]) && paxBand(next[i]) === band && isIncompletePax(next[i])) {
          idx = i;
          break;
        }
      }
      if (idx < 0) break;
      next.splice(idx, 1);
      have -= 1;
    }
  }
  return syncPaxToPartySize(next, next.length, equalMode);
}

/** Fill an empty slot of the same age band, else append. An adult never occupies a child slot. */
export function attachGuestToPax(
  pax: PaxRow[],
  guest: { id: string; firstName: string; lastName: string; birthDate?: string },
  opts: { equalMode: boolean; reservationGuestId: string },
): { pax: PaxRow[]; guestId: string; grew: boolean } {
  const already = pax.some((p) => p.guestId === guest.id);
  if (already) {
    return { pax, guestId: opts.reservationGuestId, grew: false };
  }

  const band = bandForBirthDate(guest.birthDate);
  const fillIdx = pax.findIndex((row) => isIncompletePax(row) && paxBand(row) === band);
  if (fillIdx >= 0) {
    const fillingPrimary =
      Boolean(pax[fillIdx]?.isPrimary) ||
      (!pax.some((r) => r.isPrimary) && fillIdx === 0) ||
      !opts.reservationGuestId;
    const next = pax.map((row, j) => {
      if (j !== fillIdx) {
        if (!fillingPrimary || opts.equalMode) return row;
        return { ...row, isPrimary: false, ownsFolio: opts.equalMode };
      }
      return {
        ...row,
        guestId: guest.id,
        firstName: guest.firstName || row.firstName,
        lastName: guest.lastName || row.lastName,
        birthDate: guest.birthDate || row.birthDate,
        age: guest.birthDate ? ageYearsFromBirthDate(guest.birthDate) : row.age,
        isPrimary: fillingPrimary && !opts.equalMode ? true : row.isPrimary && !opts.equalMode,
        ownsFolio: opts.equalMode || (fillingPrimary && !opts.equalMode) || Boolean(row.ownsFolio),
      };
    });
    if (opts.equalMode) {
      return {
        pax: next.map((r) => ({ ...r, isPrimary: false, ownsFolio: true })),
        guestId: fillingPrimary || !opts.reservationGuestId ? guest.id : opts.reservationGuestId,
        grew: false,
      };
    }
    return {
      pax: next,
      guestId: fillingPrimary || !opts.reservationGuestId ? guest.id : opts.reservationGuestId,
      grew: false,
    };
  }

  if (pax.length === 0) {
    return {
      pax: [
        emptyPax({
          guestId: guest.id,
          firstName: guest.firstName,
          lastName: guest.lastName,
          birthDate: guest.birthDate ?? '',
          age: guest.birthDate ? ageYearsFromBirthDate(guest.birthDate) : SLOT_AGE[band],
          isPrimary: !opts.equalMode,
          ownsFolio: true,
        }),
      ],
      guestId: guest.id,
      grew: true,
    };
  }

  return {
    pax: [
      ...pax,
      emptyPax({
        guestId: guest.id,
        firstName: guest.firstName,
        lastName: guest.lastName,
        birthDate: guest.birthDate ?? '',
        age: guest.birthDate ? ageYearsFromBirthDate(guest.birthDate) : SLOT_AGE[band],
        isPrimary: false,
        ownsFolio: opts.equalMode,
      }),
    ],
    guestId: opts.reservationGuestId,
    grew: true,
  };
}

/** Hydrate empty first/last from master guest when pax.guestId matches. */
export function hydratePaxNames(
  rows: PaxRow[],
  masterGuest?: { id?: string; fullName?: string } | null,
  nameByGuestId?: Map<string, string>,
): PaxRow[] {
  return rows.map((g) => {
    if (!isIncompletePax(g)) return g;
    let full = '';
    // Only hydrate rows linked to that guest — never paint empty companion slots with booker name.
    if (masterGuest?.fullName && g.guestId && g.guestId === masterGuest.id) {
      full = masterGuest.fullName;
    } else if (g.guestId && nameByGuestId?.has(g.guestId)) {
      full = nameByGuestId.get(g.guestId) ?? '';
    }
    if (!full.trim()) return g;
    const { firstName, lastName } = splitFullName(full);
    return { ...g, firstName: firstName || g.firstName, lastName: lastName || g.lastName };
  });
}

export type LinkedGuestDemographics = {
  id?: string;
  sex?: string | null;
  nationality?: string | null;
  birthDate?: string | Date | null;
  passportNo?: string | null;
  documents?: Array<{ docType?: string | null; docNumber?: string | null; isPrimary?: boolean }>;
};

function isoDate(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (Number.isNaN(value.getTime())) return '';
  return value.toISOString().slice(0, 10);
}

export function ageYearsFromBirthDate(birthDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return '';
  const [y, m, d] = birthDate.split('-').map(Number);
  if (!y || !m || !d) return '';
  const today = new Date();
  let age = today.getUTCFullYear() - y;
  const md = today.getUTCMonth() + 1 - m;
  if (md < 0 || (md === 0 && today.getUTCDate() < d)) age -= 1;
  return age >= 0 && age < 130 ? String(age) : '';
}

function passportFromGuest(guest: LinkedGuestDemographics | null | undefined): string {
  if (!guest) return '';
  if (guest.passportNo?.trim()) return guest.passportNo.trim();
  const docs = guest.documents ?? [];
  const passport = docs.find(
    (d) => String(d.docType ?? '').toUpperCase().includes('PASSPORT') && d.docNumber?.trim(),
  );
  return passport?.docNumber?.trim() ?? '';
}

function finFromGuest(guest: LinkedGuestDemographics | null | undefined): string {
  if (!guest) return '';
  const docs = guest.documents ?? [];
  const fin = docs.find(
    (d) => GUEST_FIN_DOC_TYPES.has(String(d.docType ?? '').toUpperCase()) && d.docNumber?.trim(),
  );
  return fin?.docNumber?.trim() ?? '';
}

/**
 * Fill-not-clear party snapshot holes from linked Guest master
 * (FOCP/import often writes names only).
 */
export function hydratePaxDemographicsFromGuest(
  rows: PaxRow[],
  guestById: Map<string, LinkedGuestDemographics>,
  masterGuest?: LinkedGuestDemographics | null,
): PaxRow[] {
  return rows.map((row) => {
    const linked =
      (row.guestId ? guestById.get(row.guestId) : undefined) ??
      (row.guestId && masterGuest?.id === row.guestId ? masterGuest : undefined);
    if (!linked) return row;
    const birthDate = row.birthDate?.trim() || isoDate(linked.birthDate);
    const age = row.age?.trim() || (birthDate ? ageYearsFromBirthDate(birthDate) : '');
    return {
      ...row,
      sex: row.sex?.trim() || linked.sex?.trim() || '',
      nationality: row.nationality?.trim() || linked.nationality?.trim() || '',
      birthDate,
      age,
      passportNo: row.passportNo?.trim() || passportFromGuest(linked) || '',
      idCardNo: row.idCardNo?.trim() || finFromGuest(linked) || '',
    };
  });
}
