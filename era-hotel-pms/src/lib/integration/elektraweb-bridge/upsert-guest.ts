import { resolvePersonIdentity } from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';
import { assertHotelIdMatches } from '@/lib/integration/elektraweb-bridge/config';
import { num, parseElektrawebDate, str } from '@/lib/integration/elektraweb-bridge/normalize';

export type UpsertResult = { action: 'created' | 'updated' | 'skipped'; key: string };

export async function upsertGuestFromElektrawebRow(
  row: Record<string, unknown>,
): Promise<UpsertResult> {
  const hotelId = num(row.HOTELID) ?? num(row.OTELID);
  if (hotelId != null) await assertHotelIdMatches(hotelId);

  const externalRef = str(row.GUESTID) ?? str(row.ID);
  if (!externalRef) throw new Error('Guest row missing ID/GUESTID');

  const firstName = str(row.NAME) ?? str(row.ID_FIRSTNAME);
  const lastName = str(row.LNAME) ?? str(row.ID_LASTNAME);
  const fullName =
    str(row.FULLNAME) ??
    str(row.GUESTNAMES) ??
    ([firstName, lastName].filter(Boolean).join(' ').trim() || 'Unknown Guest');

  const passportNumber = str(row.PASSPORTNO) ?? str(row.ID_NUMBER);
  const nationalIdFin = str(row.NATIONALIDNO);
  const nationality =
    str(row.GUEST_NATIONALITY_CODE2) ??
    str(row.COUNTRYCODE) ??
    str(row.NATIONALITY) ??
    'AZ';
  const phone = str(row.PHONE) ?? str(row.CONTACTPHONE) ?? str(row.PHONE_CALCULATED);
  const email = str(row.EMAIL);
  const birthDate = parseElektrawebDate(row.BIRTHDATE);

  const existing = await prisma.guest.findFirst({ where: { externalRef } });
  let globalPersonId: string | null = existing?.globalPersonId ?? null;
  if (nationalIdFin || passportNumber) {
    try {
      const resolved = await resolvePersonIdentity({
        fin: nationalIdFin || undefined,
        passport: passportNumber || undefined,
        issuingCountry:
          nationality === 'AZ' || nationality === 'AZE'
            ? 'AZ'
            : nationality !== 'OTHER'
              ? nationality.slice(0, 2)
              : undefined,
        fullName,
        phone: phone ?? undefined,
        nationality: nationality === 'AZ' || nationality === 'AZE' ? 'AZ' : 'OTHER',
      });
      globalPersonId = resolved.globalPersonId ?? globalPersonId;
    } catch (e) {
      console.warn('elektraweb-bridge MDM resolve failed', externalRef, e);
    }
  }

  const data = {
    externalRef,
    globalPersonId: globalPersonId ?? undefined,
    fullName,
    firstName: firstName ?? undefined,
    lastName: lastName ?? undefined,
    birthDate: birthDate ?? undefined,
    nationality: nationality === 'AZE' ? 'AZ' : nationality,
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
      birthDate: data.birthDate,
      nationality: data.nationality,
      phone: data.phone,
      email: data.email,
    },
  });

  return { action: existing ? 'updated' : 'created', key: externalRef };
}
