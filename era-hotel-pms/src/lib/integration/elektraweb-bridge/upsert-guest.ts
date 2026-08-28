import { resolvePersonIdentity } from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';
import { assertHotelIdMatches } from '@/lib/integration/elektraweb-bridge/config';
import { num, parseElektrawebDate, str } from '@/lib/integration/elektraweb-bridge/normalize';
import { genderFromElektrawebGuest } from '@/lib/integration/elektraweb-share-map';
import {
  classifyPersonDocuments,
  composePersonFullName,
  mapNationalityToIso,
  splitGivenAndPatronymic,
} from '@/lib/person-documents';

export type UpsertResult = { action: 'created' | 'updated' | 'skipped'; key: string };

export async function upsertGuestFromElektrawebRow(
  row: Record<string, unknown>,
): Promise<UpsertResult> {
  const hotelId = num(row.HOTELID) ?? num(row.OTELID);
  if (hotelId != null) await assertHotelIdMatches(hotelId);

  const externalRef = str(row.GUESTID) ?? str(row.ID);
  if (!externalRef) throw new Error('Guest row missing ID/GUESTID');

  const givenField = str(row.NAME) ?? str(row.ID_FIRSTNAME);
  const lastName = str(row.LNAME) ?? str(row.ID_LASTNAME);
  const { firstName, middleName } = splitGivenAndPatronymic(givenField);
  const composed = composePersonFullName(firstName, middleName, lastName);
  const fullName =
    str(row.FULLNAME) ?? str(row.GUESTNAMES) ?? composed || 'Unknown Guest';

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
  const birthDate = parseElektrawebDate(row.BIRTHDATE);
  const gender =
    genderFromElektrawebGuest({
      gender: str(row.GENDER) ?? str(row.SEX) ?? str(row.GENDERCODE),
      title: str(row.TITLE) ?? str(row.ID_TITLE),
    }) ?? str(row.GENDER) ?? str(row.SEX);

  const existing = await prisma.guest.findFirst({ where: { externalRef } });
  let globalPersonId: string | null = existing?.globalPersonId ?? null;
  try {
    const resolved = await resolvePersonIdentity({
      fin: docs.fin,
      passport: docs.passport,
      issuingCountry: iso,
      fullName,
      phone: phone ?? undefined,
      nationality: iso === 'AZ' ? 'AZ' : 'OTHER',
      globalPersonId: globalPersonId || undefined,
      gender: gender ?? undefined,
      birthDate: birthDate ?? undefined,
    });
    globalPersonId = resolved.globalPersonId ?? globalPersonId;
  } catch (e) {
    console.warn('elektraweb-bridge MDM resolve failed', externalRef, e);
  }

  const data = {
    externalRef,
    globalPersonId: globalPersonId ?? undefined,
    fullName,
    firstName: firstName ?? undefined,
    lastName: lastName ?? undefined,
    middleName: middleName ?? undefined,
    gender: gender ?? undefined,
    birthDate: birthDate ?? undefined,
    nationality: iso,
    phone: phone ?? undefined,
    email: email ?? undefined,
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
      gender: data.gender,
      birthDate: data.birthDate,
      nationality: data.nationality,
      phone: data.phone,
      email: data.email,
    },
  });

  return { action: existing ? 'updated' : 'created', key: externalRef };
}
