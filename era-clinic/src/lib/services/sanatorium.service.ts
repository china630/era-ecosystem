import { prisma } from '@/lib/prisma';
import { instantiateProgramFromTemplate } from '@/lib/sanatorium-scheduler.service';

function refCodeFromPassport(passport: string): string {
  return `HOTEL-${passport.replace(/\s+/g, '-').slice(0, 24)}`;
}

function walkInRefCode(finOrPassport: string): string {
  return `WALKIN-${finOrPassport.replace(/\s+/g, '-').slice(0, 20)}`;
}

export async function openEpisodeFromStay(input: {
  reservationId: string;
  hotelStayId?: string | null;
  guestName: string;
  passportNumber: string;
  phone?: string;
  organizationId: string;
  globalPersonId?: string | null;
  programCode?: string | null;
  roomNumber?: string | null;
}) {
  const existing = await prisma.clinicalEpisode.findFirst({
    where: { reservationId: input.reservationId, status: 'OPEN' },
  });
  if (existing) {
    if (input.roomNumber && existing.roomNumber !== input.roomNumber) {
      return prisma.clinicalEpisode.update({
        where: { id: existing.id },
        data: {
          roomNumber: input.roomNumber,
          ...(input.programCode ? { programCode: input.programCode } : {}),
        },
        include: { patientRef: true, complaints: true, diagnoses: true, labOrders: true },
      });
    }
    return existing;
  }

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
      roomNumber: input.roomNumber ?? null,
      organizationId: input.organizationId,
      patientOrigin: 'IN_HOUSE',
      programCode: input.programCode ?? null,
      status: 'OPEN',
    },
    include: { patientRef: true, complaints: true, diagnoses: true, labOrders: true },
  });
}

export async function registerWalkInEpisode(input: {
  organizationId: string;
  fullName: string;
  fin?: string;
  passport?: string;
  phone?: string;
  sex: "MALE" | "FEMALE";
  birthDate?: string;
  nationality?: string;
  issuingCountry?: string;
  globalPersonId?: string | null;
  programCode?: string;
}) {
  const key = input.fin?.trim() || input.passport?.trim();
  if (!key) throw new Error("FIN or passport required");
  const refCode = walkInRefCode(key);

  let patient = await prisma.patientRef.findUnique({ where: { refCode } });
  const birthDate = input.birthDate?.trim()
    ? new Date(`${input.birthDate.trim()}T00:00:00.000Z`)
    : undefined;

  if (!patient) {
    patient = await prisma.patientRef.create({
      data: {
        refCode,
        fullName: input.fullName,
        phone: input.phone ?? null,
        nationality: input.nationality?.trim() || "AZ",
        sex: input.sex,
        birthDate: birthDate ?? null,
        globalPersonId: input.globalPersonId ?? null,
      },
    });
  } else {
    patient = await prisma.patientRef.update({
      where: { id: patient.id },
      data: {
        fullName: input.fullName,
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        ...(input.nationality?.trim() ? { nationality: input.nationality.trim() } : {}),
        sex: input.sex,
        ...(birthDate !== undefined ? { birthDate } : {}),
        ...(input.globalPersonId ? { globalPersonId: input.globalPersonId } : {}),
      },
    });
  }

  const episode = await prisma.clinicalEpisode.create({
    data: {
      patientRefId: patient.id,
      globalPersonId: input.globalPersonId ?? patient.globalPersonId,
      organizationId: input.organizationId,
      patientOrigin: "WALK_IN",
      programCode: input.programCode ?? null,
      status: "OPEN",
    },
    include: { patientRef: true },
  });
  return episode;
}

export async function completeCheckupAndSchedule(input: {
  episodeId: string;
  programCode?: string;
  startsOn?: Date;
}) {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: input.episodeId },
    include: {
      complaints: true,
      diagnoses: true,
      programInstance: true,
    },
  });
  if (!episode) throw new Error('Episode not found');
  if (episode.programInstance) throw new Error('Program already assigned');
  if (episode.complaints.length === 0 && episode.diagnoses.length === 0) {
    throw new Error('Add at least one complaint or diagnosis before scheduling');
  }

  const programCode = input.programCode ?? episode.programCode;
  if (!programCode) throw new Error('Program code required');

  await prisma.clinicalEpisode.update({
    where: { id: episode.id },
    data: { checkupCompletedAt: new Date(), programCode },
  });

  const instance = await instantiateProgramFromTemplate({
    episodeId: episode.id,
    programCode,
    reservationId: episode.reservationId ?? undefined,
    startsOn: input.startsOn ?? new Date(),
  });
  return instance;
}

export async function listOpenEpisodes(organizationId?: string) {
  return prisma.clinicalEpisode.findMany({
    where: {
      status: 'OPEN',
      ...(organizationId ? { organizationId } : {}),
    },
    include: {
      patientRef: true,
      complaints: { orderBy: { recordedAt: 'desc' }, take: 3 },
      diagnoses: {
        orderBy: { recordedAt: 'desc' },
        take: 3,
        include: { icdCode: true },
      },
      labOrders: { orderBy: { createdAt: 'desc' }, take: 5 },
      programInstance: {
        include: { procedureLines: { orderBy: { procedureCode: 'asc' } } },
      },
    },
    orderBy: { openedAt: 'desc' },
  });
}

/** @deprecated use listOpenEpisodes */
export async function listInHouseEpisodes(organizationId?: string) {
  return listOpenEpisodes(organizationId);
}

export async function addComplaint(episodeId: string, text: string) {
  return prisma.clinicalComplaint.create({
    data: { episodeId, text },
  });
}

export async function addDiagnosis(
  episodeId: string,
  input: { icdCode?: string; icdCodeId?: string; description: string },
) {
  let icdCodeId = input.icdCodeId;
  if (!icdCodeId && input.icdCode) {
    const icd = await prisma.icdCode.findUnique({ where: { code: input.icdCode } });
    icdCodeId = icd?.id;
  }
  return prisma.clinicalDiagnosis.create({
    data: {
      episodeId,
      icdCodeId: icdCodeId ?? null,
      icdCodeText: input.icdCode ?? null,
      description: input.description,
    },
  });
}

export async function createEpisodeLabOrder(episodeId: string, testCode: string) {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    include: { patientRef: true },
  });
  if (!episode?.patientRefId) throw new Error('Episode patient not found');
  const patientRefId = episode.patientRefId;

  // Fasting labs: schedule collection for next working morning (Asia/Baku ~08:00)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  // Skip Sunday (0)
  if (tomorrow.getDay() === 0) {
    tomorrow.setDate(tomorrow.getDate() + 1);
  }

  const service = await prisma.diagnosticService.findFirst({
    where: { OR: [{ code: testCode }, { serviceCode: testCode }] },
  });

  const orderId = await prisma.$transaction(async (tx) => {
    const order = await tx.labOrder.create({
      data: {
        patientRefId,
        clinicalEpisodeId: episodeId,
        testCode,
        status: 'ORDERED',
        fasting: true,
        scheduledCollectionAt: tomorrow,
        source: 'IN_HOUSE',
      },
    });
    await tx.labOrderItem.create({
      data: {
        labOrderId: order.id,
        diagnosticServiceId: service?.id,
        serviceCode: testCode,
      },
    });
    return order.id;
  });

  return prisma.labOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { patientRef: true },
  });
}

export async function getEpisode(id: string) {
  return prisma.clinicalEpisode.findUnique({
    where: { id },
    include: {
      patientRef: true,
      complaints: { orderBy: { recordedAt: 'desc' } },
      diagnoses: { orderBy: { recordedAt: 'desc' }, include: { icdCode: true } },
      labOrders: { orderBy: { createdAt: 'desc' } },
      programInstance: {
        include: {
          procedureLines: { orderBy: { procedureCode: 'asc' } },
        },
      },
    },
  });
}

export async function getEpisodeSchedule(
  episodeId: string,
  from: Date,
  to: Date,
  locale = "en",
) {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    select: { patientRefId: true },
  });
  if (!episode?.patientRefId) return [];

  const orders = await prisma.procedureOrder.findMany({
    where: {
      patientRefId: episode.patientRefId,
      scheduledAt: { gte: from, lt: to },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const { loadCatalogDisplayNameMap, resolveOrderDisplayName } = await import(
    "@/domain/catalog/catalog-display-name.service"
  );
  const catalogNames = await loadCatalogDisplayNameMap(
    orders.map((o) => o.procedureCode),
    locale,
  );
  return orders.map((o) => ({
    ...o,
    procedureName: resolveOrderDisplayName(o, catalogNames),
  }));
}
