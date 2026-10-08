/** FIN / passport doc types on GuestDocument (see backfill-global-person-id). */
export const GUEST_FIN_DOC_TYPES = new Set(['ID_CARD', 'FIN', 'NATIONAL_ID']);
export const GUEST_PASSPORT_DOC_TYPES = new Set(['PASSPORT']);

export type GuestDocumentSlice = {
  docType: string;
  docNumber: string;
  isPrimary: boolean;
};

export function pickGuestDocNumber(
  documents: GuestDocumentSlice[],
  types: Set<string>,
): string | null {
  const match = documents.find((d) => types.has(d.docType) && d.docNumber.trim());
  return match?.docNumber.trim() ?? null;
}

export function extractGuestIdentityDocs(documents: GuestDocumentSlice[]): {
  nationalIdFin: string | null;
  passportNumber: string | null;
} {
  return {
    nationalIdFin: pickGuestDocNumber(documents, GUEST_FIN_DOC_TYPES),
    passportNumber: pickGuestDocNumber(documents, GUEST_PASSPORT_DOC_TYPES),
  };
}

export type GuestListItem = {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  sex: string | null;
  nationality: string;
  birthDate: string | null;
  birthPlace: string | null;
  phone: string | null;
  email: string | null;
  externalRef: string | null;
  globalPersonId: string | null;
  nationalIdFin: string | null;
  passportNumber: string | null;
  vehiclePlate: string | null;
  registrationNumber: string | null;
  visaNumber: string | null;
};

export function mapGuestToListItem(guest: {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  sex: string | null;
  nationality: string;
  birthDate: Date | null;
  birthPlace: string | null;
  phone: string | null;
  email: string | null;
  externalRef: string | null;
  globalPersonId: string | null;
  vehiclePlate: string | null;
  registrationNumber: string | null;
  visaNumber: string | null;
  documents: GuestDocumentSlice[];
}): GuestListItem {
  const { nationalIdFin, passportNumber } = extractGuestIdentityDocs(guest.documents ?? []);
  return {
    id: guest.id,
    fullName: guest.fullName,
    firstName: guest.firstName,
    lastName: guest.lastName,
    title: guest.title,
    sex: guest.sex,
    nationality: guest.nationality,
    birthDate: guest.birthDate ? guest.birthDate.toISOString().slice(0, 10) : null,
    birthPlace: guest.birthPlace,
    phone: guest.phone,
    email: guest.email,
    externalRef: guest.externalRef,
    globalPersonId: guest.globalPersonId,
    nationalIdFin,
    passportNumber,
    vehiclePlate: guest.vehiclePlate,
    registrationNumber: guest.registrationNumber,
    visaNumber: guest.visaNumber,
  };
}

export function formatGuestGenderLabel(
  gender: string | null | undefined,
  labels: { male: string; female: string; other: string },
): string {
  const g = (gender ?? '').trim().toUpperCase();
  if (g === 'M' || g === 'MALE' || g === '0') return labels.male;
  if (g === 'F' || g === 'FEMALE' || g === '1') return labels.female;
  if (!g) return '—';
  return labels.other;
}

export type GuestHitFields = {
  id: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  sex?: string;
  nationality?: string;
  birthDate?: string;
  passportNo?: string;
  idCardNo?: string;
};

/** GET /api/guests returns `{ items, total }`. Older callers still sent a bare array. */
export function guestListItems(payload: unknown): GuestHitFields[] {
  const rows: unknown[] = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === 'object' &&
        Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: unknown[] }).items
      : [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const rec = row as Record<string, unknown>;
    const id = rec.id;
    if (typeof id !== 'string' || !id) return [];
    const fullName = typeof rec.fullName === 'string' ? rec.fullName : '';
    const str = (key: string) => (typeof rec[key] === 'string' ? (rec[key] as string) : '');
    return [
      {
        id,
        fullName,
        firstName: str('firstName') || undefined,
        lastName: str('lastName') || undefined,
        sex: str('sex') || undefined,
        nationality: str('nationality') || undefined,
        birthDate: str('birthDate').slice(0, 10) || undefined,
        passportNo: str('passportNumber') || undefined,
        idCardNo: str('nationalIdFin') || undefined,
      },
    ];
  });
}
