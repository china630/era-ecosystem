import { paxHasRealName } from '@/lib/reservation-names';
import type { PaxRow } from './types';

/** Party row with no display name — fillable slot (may still have guestId from TBA/hold). */
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

/** When party list grows/shrinks, adjust adults first, then child age buckets. */
export function syncCountsFromPaxLength(
  paxLength: number,
  counts: {
    adults: number;
    children11_6: number;
    children5_2: number;
    children1_0: number;
  },
): {
  adults: number;
  children11_6: number;
  children5_2: number;
  children1_0: number;
} {
  let adults = Math.max(0, counts.adults || 0);
  let children11_6 = Math.max(0, counts.children11_6 || 0);
  let children5_2 = Math.max(0, counts.children5_2 || 0);
  let children1_0 = Math.max(0, counts.children1_0 || 0);
  const current = adults + children11_6 + children5_2 + children1_0;
  const target = Math.max(0, paxLength);

  if (target === current) {
    return { adults, children11_6, children5_2, children1_0 };
  }

  if (target > current) {
    adults += target - current;
    return { adults, children11_6, children5_2, children1_0 };
  }

  let need = current - target;
  while (need > 0 && adults > 1) {
    adults -= 1;
    need -= 1;
  }
  while (need > 0 && children1_0 > 0) {
    children1_0 -= 1;
    need -= 1;
  }
  while (need > 0 && children5_2 > 0) {
    children5_2 -= 1;
    need -= 1;
  }
  while (need > 0 && children11_6 > 0) {
    children11_6 -= 1;
    need -= 1;
  }
  while (need > 0 && adults > 0) {
    adults -= 1;
    need -= 1;
  }

  return { adults, children11_6, children5_2, children1_0 };
}

/** Fill first incomplete slot, else append companion / create primary. */
export function attachGuestToPax(
  pax: PaxRow[],
  guest: { id: string; firstName: string; lastName: string },
  opts: { equalMode: boolean; reservationGuestId: string },
): { pax: PaxRow[]; guestId: string; grew: boolean } {
  const already = pax.some((p) => p.guestId === guest.id);
  if (already) {
    return { pax, guestId: opts.reservationGuestId, grew: false };
  }

  const fillIdx = pax.findIndex(isIncompletePax);
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

function ageYearsFromBirthDate(birthDate: string): string {
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
  const passport =
    docs.find((d) => String(d.docType ?? '').toUpperCase().includes('PASSPORT') && d.docNumber?.trim()) ??
    docs.find((d) => d.isPrimary && d.docNumber?.trim()) ??
    docs.find((d) => d.docNumber?.trim());
  return passport?.docNumber?.trim() ?? '';
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
    };
  });
}
