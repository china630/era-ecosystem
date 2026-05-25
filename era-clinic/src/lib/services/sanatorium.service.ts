import { prisma } from '@/lib/prisma';

function refCodeFromPassport(passport: string): string {
  return `HOTEL-${passport.replace(/\s+/g, '-').slice(0, 24)}`;
}

export async function openEpisodeFromStay(input: {
  reservationId: string;
  hotelStayId?: string | null;
  guestName: string;
  passportNumber: string;
  phone?: string;
  organizationId: string;
  globalPersonId?: string | null;
}) {
  const existing = await prisma.clinicalEpisode.findFirst({
    where: { reservationId: input.reservationId, status: 'OPEN' },
  });
  if (existing) return existing;

  const refCode = refCodeFromPassport(input.passportNumber);
  let patient = await prisma.patientRef.findUnique({ where: { refCode } });
  if (!patient) {
    patient = await prisma.patientRef.create({
      data: {
        refCode,
        fullName: input.guestName,
        phone: input.phone ?? null,
        globalPersonId: input.globalPersonId ?? null,
      },
    });
  }

  return prisma.clinicalEpisode.create({
    data: {
      patientRefId: patient.id,
      globalPersonId: input.globalPersonId ?? patient.globalPersonId,
      hotelStayId: input.hotelStayId ?? null,
      reservationId: input.reservationId,
      organizationId: input.organizationId,
      status: 'OPEN',
    },
    include: { patientRef: true, complaints: true, diagnoses: true, labOrders: true },
  });
}

export async function listInHouseEpisodes(organizationId?: string) {
  return prisma.clinicalEpisode.findMany({
    where: {
      status: 'OPEN',
      ...(organizationId ? { organizationId } : {}),
    },
    include: {
      patientRef: true,
      complaints: { orderBy: { recordedAt: 'desc' }, take: 3 },
      diagnoses: { orderBy: { recordedAt: 'desc' }, take: 3 },
      labOrders: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
    orderBy: { openedAt: 'desc' },
  });
}

export async function addComplaint(episodeId: string, text: string) {
  return prisma.clinicalComplaint.create({
    data: { episodeId, text },
  });
}

export async function addDiagnosis(
  episodeId: string,
  input: { icdCode?: string; description: string },
) {
  return prisma.clinicalDiagnosis.create({
    data: { episodeId, icdCode: input.icdCode ?? null, description: input.description },
  });
}

export async function createEpisodeLabOrder(episodeId: string, testCode: string) {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    include: { patientRef: true },
  });
  if (!episode?.patientRefId) throw new Error('Episode patient not found');

  return prisma.labOrder.create({
    data: {
      patientRefId: episode.patientRefId,
      clinicalEpisodeId: episodeId,
      testCode,
      status: 'ORDERED',
    },
    include: { patientRef: true },
  });
}

export async function getEpisode(id: string) {
  return prisma.clinicalEpisode.findUnique({
    where: { id },
    include: {
      patientRef: true,
      complaints: { orderBy: { recordedAt: 'desc' } },
      diagnoses: { orderBy: { recordedAt: 'desc' } },
      labOrders: { orderBy: { createdAt: 'desc' } },
    },
  });
}
