import { prisma } from '@/lib/prisma';
import { ymdParam } from '@/lib/reports/civil-days';
import { GUEST_PASSPORT_DOC_TYPES } from '@/lib/guest-list-identity';
import { isSimilarPersonName, namesClearlyDiffer, sameMetaphoneName } from '@/lib/guest-name-match';
import { normalizeNameKey } from '@/lib/mrz/names';
import type { MrzDocument } from '@/lib/mrz/parse';
import { mapNationalityToIso } from '@/lib/person-documents';
import { namesMatchWithTranslit, normalizeMrzNameField } from '@/lib/mrz/transliterate';

function countryKey(raw: string | null | undefined): string {
  return (mapNationalityToIso(raw) ?? (raw ?? '').trim().toUpperCase()).toUpperCase();
}

export type MrzGuestHit = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  sex: string | null;
  nationality: string | null;
  passportNo: string | null;
  expiresAt: string | null;
  mrzNameField: string | null;
};

export type MrzMatch =
  | { kind: 'none' }
  | { kind: 'mrz'; guest: MrzGuestHit }
  | { kind: 'passport'; guest: MrzGuestHit; nameClash: boolean }
  | { kind: 'identity'; guests: MrzGuestHit[]; expiry: 'newer' | 'older' | 'unknown' }
  | { kind: 'similar'; guests: MrzGuestHit[]; reason: 'typo' | 'metaphone' | 'translit' }
  | { kind: 'list'; guests: MrzGuestHit[] };

function sexClash(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.toUpperCase() !== b.toUpperCase();
}

function expiryFor(guest: MrzGuestHit, doc: MrzDocument): 'newer' | 'older' | 'unknown' {
  if (guest.expiresAt && doc.expiryDate) {
    return doc.expiryDate > guest.expiresAt ? 'newer' : 'older';
  }
  return 'unknown';
}

export async function matchMrzGuest(doc: MrzDocument, currentGuestId?: string | null): Promise<MrzMatch> {
  const guests = await prisma.guest.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      sex: true,
      nationality: true,
      documents: {
        select: {
          docType: true,
          docNumber: true,
          nationality: true,
          expiresAt: true,
          isPrimary: true,
          mrzNameField: true,
        },
      },
    },
  });

  const number = doc.documentNumber.replace(/[\s-]/g, '').toUpperCase();
  const country = countryKey(doc.issuingCountry);
  const nat = countryKey(doc.nationality);
  const rawName = normalizeMrzNameField(doc.nameFieldRaw);

  const cards: MrzGuestHit[] = guests.map((guest) => {
    const passports = guest.documents.filter((row) =>
      GUEST_PASSPORT_DOC_TYPES.has(String(row.docType ?? '').toUpperCase()),
    );
    const primary = passports.find((row) => row.isPrimary) ?? passports[0];
    const withMrz =
      passports.find((row) => row.mrzNameField?.trim()) ?? primary;
    return {
      id: guest.id,
      firstName: guest.firstName,
      lastName: guest.lastName,
      birthDate: guest.birthDate ? ymdParam(guest.birthDate) : null,
      sex: guest.sex,
      nationality: guest.nationality,
      passportNo: primary?.docNumber ?? null,
      expiresAt: primary?.expiresAt ? ymdParam(primary.expiresAt) : null,
      mrzNameField: withMrz?.mrzNameField ?? null,
    };
  });

  if (rawName) {
    const byMrz = cards.filter((guest) => {
      if (currentGuestId && guest.id === currentGuestId) return false;
      const stored = guest.mrzNameField ? normalizeMrzNameField(guest.mrzNameField) : '';
      return Boolean(stored) && stored === rawName;
    });
    if (byMrz.length === 1) return { kind: 'mrz', guest: byMrz[0]! };
    if (byMrz.length > 1) return { kind: 'list', guests: byMrz };
  }

  const byPassport = guests.find((guest) =>
    guest.documents.some((row) => {
      const kind = String(row.docType ?? '').toUpperCase();
      if (!GUEST_PASSPORT_DOC_TYPES.has(kind)) return false;
      const num = row.docNumber.replace(/[\s-]/g, '').toUpperCase();
      const docCountry = countryKey(row.nationality ?? guest.nationality);
      return num === number && (!docCountry || docCountry === country || docCountry === nat);
    }),
  );
  if (byPassport) {
    const guest = cards.find((row) => row.id === byPassport.id)!;
    return {
      kind: 'passport',
      guest,
      nameClash: namesClearlyDiffer(
        doc.firstName,
        doc.lastName,
        guest.firstName ?? '',
        guest.lastName ?? '',
      ),
    };
  }

  const pool = cards.filter((guest) => {
    if (currentGuestId && guest.id === currentGuestId) return false;
    if (sexClash(doc.sex, guest.sex)) return false;
    if (!guest.birthDate || guest.birthDate !== doc.birthDate) return false;
    const guestNat = countryKey(guest.nationality);
    if (guestNat && guestNat !== nat && guestNat !== country) return false;
    return true;
  });

  const first = normalizeNameKey(doc.firstName);
  const last = normalizeNameKey(doc.lastName);
  const identity = pool.filter(
    (guest) =>
      normalizeNameKey(guest.firstName ?? '') === first &&
      normalizeNameKey(guest.lastName ?? '') === last,
  );
  if (identity.length === 1) {
    return { kind: 'identity', guests: identity, expiry: expiryFor(identity[0]!, doc) };
  }
  if (identity.length > 1) return { kind: 'list', guests: identity };

  const translit = pool.filter((guest) =>
    namesMatchWithTranslit(
      doc.firstName,
      doc.lastName,
      guest.firstName ?? '',
      guest.lastName ?? '',
    ),
  );
  if (translit.length >= 1) return { kind: 'similar', guests: translit, reason: 'translit' };

  const typo = pool.filter((guest) =>
    isSimilarPersonName(doc.firstName, doc.lastName, guest.firstName ?? '', guest.lastName ?? ''),
  );
  if (typo.length >= 1) return { kind: 'similar', guests: typo, reason: 'typo' };

  const metaphone = pool.filter((guest) =>
    sameMetaphoneName(doc.firstName, doc.lastName, guest.firstName ?? '', guest.lastName ?? ''),
  );
  if (metaphone.length >= 1) return { kind: 'similar', guests: metaphone, reason: 'metaphone' };

  return { kind: 'none' };
}
