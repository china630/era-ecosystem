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
