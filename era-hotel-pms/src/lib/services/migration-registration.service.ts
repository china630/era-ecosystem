import { resolveIdentifierForCompliance } from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';

export async function createMigrationRegistration(input: {
  guestId: string;
  reservationId?: string;
}) {
  const guest = await prisma.guest.findUnique({
    where: { id: input.guestId },
    include: { documents: true, addresses: true },
  });
  if (!guest) throw new Error('Guest not found');

  const payload = await buildMigrationPayload(guest, input.reservationId);
  return prisma.migrationRegistration.create({
    data: {
      guestId: input.guestId,
      reservationId: input.reservationId,
      payloadJson: JSON.stringify(payload),
    },
  });
}

export async function buildMigrationPayload(
  guest: {
    globalPersonId: string | null;
    fullName: string;
    nationality: string;
    birthDate: Date | null;
    visaType: string | null;
    visaNumber: string | null;
    visaExpiry: Date | null;
    documents: Array<{ docType: string; docNumber: string | null }>;
  },
  reservationId?: string,
) {
  let passportNumber: string | null = null;
  let nationalIdFin: string | null = null;
  if (guest.globalPersonId) {
    const identity = await resolveIdentifierForCompliance(guest.globalPersonId);
    if (identity && !identity.accessDenied) {
      passportNumber = identity.passportNumber;
      nationalIdFin = identity.fin;
    }
  }

  return {
    schemaVersion: 1,
    reservationId: reservationId ?? null,
    person: {
      fullName: guest.fullName,
      passportNumber,
      nationalIdFin,
      nationality: guest.nationality,
      birthDate: guest.birthDate?.toISOString().slice(0, 10) ?? null,
      visaType: guest.visaType,
      visaNumber: guest.visaNumber,
      visaExpiry: guest.visaExpiry?.toISOString().slice(0, 10) ?? null,
    },
    documents: guest.documents.map((d) => ({
      type: d.docType,
      number: d.docNumber,
    })),
    note: 'Skeleton payload — no submission to Migration Service API',
  };
}

export async function getMigrationPrefill(registrationId: string) {
  const row = await prisma.migrationRegistration.findUnique({
    where: { id: registrationId },
    include: { guest: { include: { documents: true } } },
  });
  if (!row) throw new Error('Registration not found');
  const payload = row.payloadJson
    ? JSON.parse(row.payloadJson)
    : await buildMigrationPayload(row.guest, row.reservationId ?? undefined);
  return { registrationId: row.id, status: row.status, payload };
}
