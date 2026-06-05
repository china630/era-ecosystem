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

  const payload = buildMigrationPayload(guest, input.reservationId);
  return prisma.migrationRegistration.create({
    data: {
      guestId: input.guestId,
      reservationId: input.reservationId,
      payloadJson: JSON.stringify(payload),
    },
  });
}

export function buildMigrationPayload(
  guest: {
    fullName: string;
    passportNumber: string | null;
    nationalIdFin: string | null;
    nationality: string;
    birthDate: Date | null;
    visaType: string | null;
    visaNumber: string | null;
    visaExpiry: Date | null;
    documents: Array<{ docType: string; docNumber: string | null }>;
  },
  reservationId?: string,
) {
  return {
    schemaVersion: 1,
    reservationId: reservationId ?? null,
    person: {
      fullName: guest.fullName,
      passportNumber: guest.passportNumber,
      nationalIdFin: guest.nationalIdFin,
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
    : buildMigrationPayload(row.guest, row.reservationId ?? undefined);
  return { registrationId: row.id, status: row.status, payload };
}
