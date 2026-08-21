import { z } from 'zod';
import { resolvePersonIdentity } from '@era/satellite-kit';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { cellBool, cellNumber, cellString, parseDateCell } from '@/lib/import/helpers';
import type { ImportAdapter } from '@/lib/import/types';
import { genderFromElektrawebGuest } from '@/lib/integration/elektraweb-share-map';

const rowSchema = z.object({
  externalRef: z.string().min(1),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  fullName: z.string().min(1),
  title: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  birthDate: z.date().optional().nullable(),
  passportNumber: z.string().optional().nullable(),
  nationalIdFin: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  vipType: z.string().optional().nullable(),
  greyList: z.boolean().optional(),
  gdprConfirmed: z.boolean().optional(),
  visitCount: z.number().int().optional(),
  vehiclePlate: z.string().optional().nullable(),
});

export const guestsAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: 'guests',
  label: 'Guests',
  order: 40,
  permission: PERMISSIONS.RESERVATIONS_WRITE,
  templateHint: 'Guests.xlsx',
  headerAliases: {
    'Guest Id': 'externalRef',
    Name: 'firstName',
    'Last Name': 'lastName',
    Title: 'title',
    Gender: 'gender',
    'Birth Date': 'birthDate',
    'Passport No': 'passportNumber',
    'National Id No': 'nationalIdFin',
    Nationality: 'nationality',
    Phone: 'phone',
    Email: 'email',
    'Vip Type': 'vipType',
    'Grey List': 'greyList',
    'GDPR Confirmed': 'gdprConfirmed',
    'Repeat Count': 'visitCount',
    'Vehicle Plate': 'vehiclePlate',
  },
  rowSchema,
  mapRow: (raw) => {
    const firstName = cellString(raw.firstName);
    const lastName = cellString(raw.lastName);
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const title = cellString(raw.title);
    const genderRaw = cellString(raw.gender);
    const gender = genderFromElektrawebGuest({ gender: genderRaw, title });
    return {
      externalRef: cellString(raw.externalRef),
      firstName,
      lastName,
      fullName: fullName || firstName || lastName || 'Unknown Guest',
      title,
      gender: gender ?? genderRaw,
      birthDate: parseDateCell(raw.birthDate),
      passportNumber: cellString(raw.passportNumber),
      nationalIdFin: cellString(raw.nationalIdFin),
      nationality: cellString(raw.nationality) ?? 'AZ',
      phone: cellString(raw.phone),
      email: cellString(raw.email),
      vipType: cellString(raw.vipType),
      greyList: cellBool(raw.greyList),
      gdprConfirmed: cellBool(raw.gdprConfirmed),
      visitCount: cellNumber(raw.visitCount) ?? 0,
      vehiclePlate: cellString(raw.vehiclePlate),
    };
  },
  upsert: async (tx, row, dryRun) => {
    const existing = await tx.guest.findFirst({ where: { externalRef: row.externalRef } });

    let globalPersonId: string | null = existing?.globalPersonId ?? null;
    if (!dryRun && (row.nationalIdFin || row.passportNumber)) {
      const fin = row.nationalIdFin?.trim();
      const passport = row.passportNumber?.trim();
      const nationality = row.nationality ?? 'AZ';
      const resolved = await resolvePersonIdentity({
        fin: fin || undefined,
        passport: passport || undefined,
        issuingCountry:
          nationality === 'AZ' ? 'AZ' : nationality !== 'OTHER' ? nationality : undefined,
        fullName: row.fullName,
        phone: row.phone ?? undefined,
        nationality: nationality === 'AZ' ? 'AZ' : 'OTHER',
      });
      globalPersonId = resolved.globalPersonId ?? globalPersonId;
    }

    const data = {
      externalRef: row.externalRef,
      globalPersonId: globalPersonId ?? undefined,
      fullName: row.fullName,
      firstName: row.firstName ?? undefined,
      lastName: row.lastName ?? undefined,
      title: row.title ?? undefined,
      gender: row.gender ?? undefined,
      birthDate: row.birthDate ?? undefined,
      nationality: row.nationality ?? 'AZ',
      phone: row.phone ?? undefined,
      email: row.email ?? undefined,
      vipType: row.vipType ?? undefined,
      greyList: row.greyList ?? false,
      gdprConfirmed: row.gdprConfirmed ?? false,
      visitCount: row.visitCount ?? 0,
      vehiclePlate: row.vehiclePlate ?? undefined,
    };
    if (dryRun) return existing ? 'updated' : 'created';
    await tx.guest.upsert({
      where: { externalRef: row.externalRef } as never,
      create: data,
      update: {
        globalPersonId: data.globalPersonId,
        fullName: data.fullName,
        firstName: data.firstName,
        lastName: data.lastName,
        title: data.title,
        gender: data.gender,
        birthDate: data.birthDate,
        nationality: data.nationality,
        phone: data.phone,
        email: data.email,
        vipType: data.vipType,
        greyList: data.greyList,
        gdprConfirmed: data.gdprConfirmed,
        visitCount: data.visitCount,
        vehiclePlate: data.vehiclePlate,
      },
    });
    return existing ? 'updated' : 'created';
  },
};
