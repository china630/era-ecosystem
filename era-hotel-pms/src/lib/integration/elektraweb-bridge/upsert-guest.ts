import { resolvePersonIdentity } from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';
import { assertHotelIdMatches } from '@/lib/integration/elektraweb-bridge/config';
import { num, parseElektrawebDate, str } from '@/lib/integration/elektraweb-bridge/normalize';
import { syncGuestIdentityDocuments } from '@/lib/guest-document-sync';
import { genderFromElektrawebGuest } from '@/lib/integration/elektraweb-share-map';
import {
  classifyPersonDocuments,
  composePersonFullName,
  mapNationalityToIso,
  splitGivenAndPatronymic,
} from '@/lib/person-documents';

export type UpsertResult = { action: 'created' | 'updated' | 'skipped'; key: string };

/** EW list/card may use several gender keys; 0 must survive (not treated as empty). */
export function genderRawFromElektrawebGuestRow(row: Record<string, unknown>): string | null {
  const raw =
    row.GENDER ??
    row.SEX ??
    row.GENDERCODE ??
    row.GENDERID ??
    row.SEXID ??
    row.SEXCODE ??
    row.GENDER_CODE;
  if (raw == null || raw === '') return null;
  return String(raw).trim() || null;
}

function pickFilled<T>(incoming: T | null | undefined, existing: T | null | undefined): T | undefined {
  if (incoming != null && incoming !== '') return incoming as T;
  if (existing != null && existing !== '') return existing as T;
  return undefined;
}

export async function upsertGuestFromElektrawebRow(
  row: Record<string, unknown>,
): Promise<UpsertResult> {
  const hotelId = num(row.HOTELID) ?? num(row.OTELID);
  if (hotelId != null) await assertHotelIdMatches(hotelId);

  // Stay-guest rows (QA_HOTEL_RES_GUEST): ID = RESNAMEID, not Guest Card id.
  const stayResId = str(row.RESID);
  const guestCardId = str(row.GUESTID);
  if (stayResId && !guestCardId) {
    throw new Error('Stay-guest row missing GUESTID (ID is RESNAMEID)');
  }
  const externalRef = guestCardId ?? str(row.ID);
  if (!externalRef) throw new Error('Guest row missing ID/GUESTID');

  const givenField = str(row.NAME) ?? str(row.ID_FIRSTNAME);
  const lastName = str(row.LNAME) ?? str(row.ID_LASTNAME);
  const { firstName, middleName } = splitGivenAndPatronymic(givenField);
  const composed = composePersonFullName(firstName, middleName, lastName);
  // Never persist FOCP party label `A / B` as one Guest Card.
  const rawLabel = str(row.FULLNAME) ?? str(row.GUESTNAMES);
  const fullName =
    (rawLabel && !rawLabel.includes('/')
      ? rawLabel
      : composed || rawLabel?.split(/\s*\/\s*/)[0]?.trim()) ||
    'Unknown Guest';

  const docs = classifyPersonDocuments({
    nationalId: str(row.NATIONALIDNO),
    passportNo: str(row.PASSPORTNO) ?? str(row.ID_NUMBER),
  });
  const iso = mapNationalityToIso(
    str(row.GUEST_NATIONALITY_CODE2) ??
      str(row.COUNTRYCODE) ??
      str(row.NATIONALITY),
  );
  const phone = str(row.PHONE) ?? str(row.CONTACTPHONE) ?? str(row.PHONE_CALCULATED);
  const email = str(row.EMAIL);
  const birthDate = parseElektrawebDate(row.BIRTHDATE) ?? parseElektrawebDate(row.BIRTH_DATE);
  const genderRaw = genderRawFromElektrawebGuestRow(row);
  // EW Guest Cards: 0=Male, 1=Female — never persist raw codes.
  const sex = genderFromElektrawebGuest({
    gender: genderRaw,
    title: str(row.TITLE) ?? str(row.ID_TITLE),
  });

  const existing = await prisma.guest.findFirst({ where: { externalRef } });
  let globalPersonId: string | null = existing?.globalPersonId ?? null;
  try {
    const resolved = await resolvePersonIdentity({
      fin: docs.fin,
      passport: docs.passport,
      issuingCountry: iso,
      firstName: firstName ?? undefined,
      middleName: middleName ?? undefined,
      lastName: lastName ?? undefined,
      fullName,
      phone: phone ?? undefined,
      nationality: iso,
      globalPersonId: globalPersonId || undefined,
      sex: sex ?? undefined,
      birthDate: birthDate ?? undefined,
    });
    globalPersonId = resolved.globalPersonId ?? globalPersonId;
  } catch (e) {
    console.warn('elektraweb-bridge MDM resolve failed', externalRef, e);
  }

  // Fill-not-clear: sparse FOCP / list rows must not wipe sex, DOB, phone from Guest Cards.
  const data = {
    externalRef,
    globalPersonId: globalPersonId ?? existing?.globalPersonId ?? undefined,
    fullName: fullName || existing?.fullName || 'Unknown Guest',
    firstName: pickFilled(firstName, existing?.firstName),
    lastName: pickFilled(lastName, existing?.lastName),
    middleName: pickFilled(middleName, existing?.middleName),
    sex: pickFilled(sex, existing?.sex),
    birthDate: pickFilled(birthDate, existing?.birthDate),
    nationality: pickFilled(iso, existing?.nationality),
    phone: pickFilled(phone, existing?.phone),
    email: pickFilled(email, existing?.email),
  };

  await prisma.guest.upsert({
    where: { externalRef } as never,
    create: data,
    update: {
      globalPersonId: data.globalPersonId,
      fullName: data.fullName,
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName,
      sex: data.sex,
      birthDate: data.birthDate,
      nationality: data.nationality,
      phone: data.phone,
      email: data.email,
    },
  });

  const saved = await prisma.guest.findFirst({ where: { externalRef } });
  if (saved) {
    await syncGuestIdentityDocuments(prisma, saved.id, {
      nationalIdFin: docs.fin,
      passportNumber: docs.passport,
      nationality: iso ?? existing?.nationality ?? undefined,
    });
  }

  return { action: existing ? 'updated' : 'created', key: externalRef };
}
