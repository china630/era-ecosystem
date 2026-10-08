import { GUEST_FIN_DOC_TYPES, GUEST_PASSPORT_DOC_TYPES } from '@/lib/guest-list-identity';

/** Person identifiers required to save a guest card. */
export type IdentityField = 'firstName' | 'lastName' | 'sex' | 'birthDate' | 'nationality';

/** Missing at check-in. Phone is waived for guests under 18. */
export type OperationalGap = 'phone' | 'document' | 'birthDate';

export type StayOperationalGap = {
  name: string;
  gaps: OperationalGap[];
};

const PHONE_CONTACT_KINDS = new Set(['MOBILE', 'PHONE', 'WHATSAPP']);

export class GuestIdentityRequiredError extends Error {
  readonly fields: IdentityField[];

  constructor(fields: IdentityField[]) {
    super(`Required: ${fields.join(', ')}`);
    this.name = 'GuestIdentityRequiredError';
    this.fields = fields;
  }
}

export class StayCheckInBlockedError extends Error {
  readonly people: StayOperationalGap[];

  constructor(people: StayOperationalGap[]) {
    const details = people
      .map((person) => `${person.name}: ${person.gaps.join(', ')}`)
      .join('; ');
    super(`Check-in blocked. ${details}`);
    this.name = 'StayCheckInBlockedError';
    this.people = people;
  }
}

export function guestIdentityGaps(input: {
  firstName?: string | null;
  lastName?: string | null;
  sex?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
}): IdentityField[] {
  const gaps: IdentityField[] = [];
  if (!input.firstName?.trim()) gaps.push('firstName');
  if (!input.lastName?.trim()) gaps.push('lastName');
  if (!input.sex?.trim()) gaps.push('sex');
  if (!toYmd(input.birthDate)) gaps.push('birthDate');
  if (!input.nationality?.trim()) gaps.push('nationality');
  return gaps;
}

export function toYmd(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (Number.isNaN(value.getTime())) return '';
  return value.toISOString().slice(0, 10);
}

/** Age in full years on a civil date (YYYY-MM-DD). */
export function ageYearsOn(birthYmd: string, todayYmd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(todayYmd)) {
    return null;
  }
  const [y, m, d] = birthYmd.split('-').map(Number);
  const [ty, tm, td] = todayYmd.split('-').map(Number);
  if (!y || !m || !d || !ty || !tm || !td) return null;
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** Under 18. Birth date wins over a typed age. Unknown age is not a child. */
export function isMinorGuest(
  input: { birthDate?: string | Date | null; age?: number | null },
  todayYmd: string,
): boolean {
  const birth = toYmd(input.birthDate);
  if (birth) {
    const age = ageYearsOn(birth, todayYmd);
    return age != null && age < 18;
  }
  const typed = input.age;
  return typed != null && Number.isFinite(typed) && typed >= 0 && typed < 18;
}

export type StayPersonInput = {
  name: string;
  nationality?: string | null;
  birthDate?: string | Date | null;
  age?: number | null;
  phone?: string | null;
  contacts?: Array<{ kind?: string | null; value?: string | null }>;
  documents?: Array<{ docType?: string | null; docNumber?: string | null }>;
  idCardNo?: string | null;
  passportNo?: string | null;
};

export function operationalGaps(person: StayPersonInput, todayYmd: string): OperationalGap[] {
  const nationality = (person.nationality?.trim() || 'AZ').toUpperCase();
  const minor = isMinorGuest(person, todayYmd);
  const hasPhone =
    Boolean(person.phone?.trim()) ||
    (person.contacts ?? []).some(
      (row) =>
        PHONE_CONTACT_KINDS.has(String(row.kind ?? '').toUpperCase()) &&
        Boolean(row.value?.trim()),
    );
  const documents = person.documents ?? [];
  const hasFin =
    Boolean(person.idCardNo?.trim()) ||
    documents.some(
      (row) =>
        GUEST_FIN_DOC_TYPES.has(String(row.docType ?? '').toUpperCase()) &&
        Boolean(row.docNumber?.trim()),
    );
  const hasPassport =
    Boolean(person.passportNo?.trim()) ||
    documents.some(
      (row) =>
        GUEST_PASSPORT_DOC_TYPES.has(String(row.docType ?? '').toUpperCase()) &&
        Boolean(row.docNumber?.trim()),
    );

  const gaps: OperationalGap[] = [];
  if (!toYmd(person.birthDate)) gaps.push('birthDate');
  if (nationality === 'AZ' && !minor && !hasPhone) gaps.push('phone');
  if (nationality === 'AZ') {
    if (!hasFin && !hasPassport) gaps.push('document');
  } else if (!hasPassport) {
    gaps.push('document');
  }
  return gaps;
}

type StayGuestSlice = {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  nationality: string;
  birthDate: Date | null;
  phone: string | null;
  documents: Array<{ docType: string; docNumber: string }>;
  contacts: Array<{ kind: string; value: string }>;
};

type StayPaxSlice = {
  id: string;
  guestId: string | null;
  firstName: string | null;
  lastName: string | null;
  nationality: string | null;
  birthDate: Date | null;
  age: number | null;
  idCardNo: string | null;
  passportNo: string | null;
  departedAt: Date | null;
  guest: StayGuestSlice | null;
};

export type StayForOperationalGaps = {
  guest: StayGuestSlice;
  paxGuests: StayPaxSlice[];
};

function displayName(input: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}): string {
  const parts = [input.firstName, input.lastName].map((part) => part?.trim()).filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return input.fullName?.trim() || 'Guest';
}

function blankPerson(name: string): StayPersonInput {
  return {
    name,
    nationality: null,
    birthDate: null,
    age: null,
    phone: null,
    contacts: [],
    documents: [],
    idCardNo: null,
    passportNo: null,
  };
}

function mergeGuest(person: StayPersonInput, guest: StayGuestSlice) {
  if (!person.nationality?.trim() && guest.nationality) person.nationality = guest.nationality;
  if (!person.birthDate && guest.birthDate) person.birthDate = guest.birthDate;
  if (!person.phone?.trim() && guest.phone) person.phone = guest.phone;
  person.contacts = [...(person.contacts ?? []), ...guest.contacts];
  person.documents = [...(person.documents ?? []), ...guest.documents];
  if (person.name === 'Guest') person.name = displayName(guest);
}

/** Named people on the stay. Empty slots and departed companions are skipped. */
export function gapsForStay(stay: StayForOperationalGaps, todayYmd: string): StayOperationalGap[] {
  const people = new Map<string, StayPersonInput>();

  const primary = blankPerson(displayName(stay.guest));
  mergeGuest(primary, stay.guest);
  people.set(`guest:${stay.guest.id}`, primary);

  for (const pax of stay.paxGuests) {
    if (pax.departedAt) continue;
    const named = Boolean(pax.firstName?.trim() || pax.lastName?.trim() || pax.guestId);
    if (!named) continue;
    const key = pax.guestId ? `guest:${pax.guestId}` : `pax:${pax.id}`;
    const person = people.get(key) ?? blankPerson(displayName(pax));
    if (pax.firstName?.trim() || pax.lastName?.trim()) person.name = displayName(pax);
    if (!person.nationality?.trim() && pax.nationality) person.nationality = pax.nationality;
    if (!person.birthDate && pax.birthDate) person.birthDate = pax.birthDate;
    if (person.age == null && pax.age != null) person.age = pax.age;
    if (!person.idCardNo?.trim() && pax.idCardNo) person.idCardNo = pax.idCardNo;
    if (!person.passportNo?.trim() && pax.passportNo) person.passportNo = pax.passportNo;
    if (pax.guest) mergeGuest(person, pax.guest);
    people.set(key, person);
  }

  const found: StayOperationalGap[] = [];
  for (const person of people.values()) {
    const missing = operationalGaps(person, todayYmd);
    if (missing.length > 0) found.push({ name: person.name, gaps: missing });
  }
  return found;
}

export function operationalGapLabelKey(gap: string): 'gapPhone' | 'gapBirthDate' | 'gapDocument' {
  if (gap === 'phone') return 'gapPhone';
  if (gap === 'birthDate') return 'gapBirthDate';
  return 'gapDocument';
}
export function operationalGapDetails(
  people: unknown,
  label: (gap: string) => string,
): string {
  if (!Array.isArray(people)) return '';
  return people
    .map((person) => {
      const row = person as { name?: string; gaps?: string[] };
      const gaps = Array.isArray(row.gaps) ? row.gaps : [];
      return `${row.name ?? ''}: ${gaps.map(label).join(', ')}`;
    })
    .filter((line) => line.trim() !== ':')
    .join('; ');
}

export function isPreArrivalStatus(status: string | null | undefined): boolean {
  return status === 'OPTION' || status === 'CONFIRMED';
}
