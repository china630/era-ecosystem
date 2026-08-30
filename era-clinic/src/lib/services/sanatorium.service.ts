import { prisma } from '@/lib/prisma';
import { instantiateProgramFromTemplate } from '@/lib/sanatorium-scheduler.service';
import { requestOrganizationId } from '@/lib/request-organization';
import { linkPatientGlobalPerson } from '@/lib/patient-identity';
import { getPersonOpsProfile, normalizePersonSex, parsePersonBirthDate } from '@era/satellite-kit';
import { instantiateIntakePackage } from '@/domain/patient/instantiate-intake.service';

function refCodeFromPassport(passport: string): string {
  return `HOTEL-${passport.replace(/\s+/g, '-').slice(0, 24)}`;
}

/** Wave E — stable PatientRef code for in-house pax (MDM > paxKey > passport). */
export function resolveHotelPatientRefCode(input: {
  reservationId: string;
  globalPersonId?: string | null;
  paxKey?: string | null;
  passportNumber?: string | null;
}): string {
  if (input.globalPersonId?.trim()) {
    return `MDM-${input.globalPersonId.trim().slice(0, 40)}`;
  }
  if (input.paxKey?.trim()) {
    return `HOTEL-${input.reservationId.slice(0, 8)}-${input.paxKey.replace(/\s+/g, "-").slice(0, 16)}`;
  }
  return refCodeFromPassport(input.passportNumber?.trim() || input.reservationId);
}

async function safeInstantiateIntake(episodeId: string) {
  try {
    await instantiateIntakePackage(episodeId);
  } catch (err) {
    console.error("[sanatorium] instantiateIntakePackage failed", episodeId, err);
  }
}

async function applyMdmDemographicsCache(
  patientId: string,
  globalPersonId: string | null | undefined,
) {
  if (!globalPersonId?.trim()) return;
  const profile = await getPersonOpsProfile(globalPersonId.trim());
  if (!profile || profile.accessDenied) return;
  const sex = normalizePersonSex(profile.sex);
  const birthDate = parsePersonBirthDate(profile.birthDate);
  const patient = await prisma.patientRef.findUnique({ where: { id: patientId } });
  if (!patient) return;
  const nextSex =
    sex === "MALE" || sex === "FEMALE"
      ? sex
      : undefined;
  await prisma.patientRef.update({
    where: { id: patientId },
    data: {
      ...(nextSex && patient.sex === "UNKNOWN" ? { sex: nextSex } : {}),
      ...(!patient.birthDate && birthDate ? { birthDate } : {}),
      globalPersonId: globalPersonId.trim(),
    },
  });
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
  /** Wave E — stable pax key when no MDM (defaults to passport/reservation). */
  paxKey?: string | null;
}) {
  const refCode = resolveHotelPatientRefCode({
    reservationId: input.reservationId,
    globalPersonId: input.globalPersonId,
    paxKey: input.paxKey,
    passportNumber: input.passportNumber,
  });

  const patient =
    (await prisma.patientRef.findFirst({
      where: {
        organizationId: input.organizationId,
        OR: [
          ...(input.globalPersonId?.trim()
            ? [{ globalPersonId: input.globalPersonId.trim() }]
            : []),
          { refCode },
        ],
      },
    })) ??
    (await prisma.patientRef.create({
      data: {
        organizationId: input.organizationId,
        refCode,
        fullName: input.guestName,
        phone: input.phone ?? null,
        globalPersonId: input.globalPersonId ?? null,
      },
    }));

  await applyMdmDemographicsCache(patient.id, input.globalPersonId ?? patient.globalPersonId);

  // Wave E: OPEN episode keyed by reservation + patient (not reservation-only)
  const existing = await prisma.clinicalEpisode.findFirst({
    where: {
      reservationId: input.reservationId,
      patientRefId: patient.id,
      status: "OPEN",
    },
  });
  if (existing) {
    if (input.roomNumber && existing.roomNumber !== input.roomNumber) {
      const updated = await prisma.clinicalEpisode.update({
        where: { id: existing.id },
        data: {
          roomNumber: input.roomNumber,
          ...(input.programCode ? { programCode: input.programCode } : {}),
        },
        include: { patientRef: true, complaints: true, diagnoses: true, labOrders: true },
      });
      await safeInstantiateIntake(updated.id);
      return updated;
    }
    if (input.programCode && !existing.programCode) {
      await prisma.clinicalEpisode.update({
        where: { id: existing.id },
        data: { programCode: input.programCode },
      });
    }
    await safeInstantiateIntake(existing.id);
    return existing;
  }

  const created = await prisma.clinicalEpisode.create({
    data: {
      organizationId: input.organizationId,
      patientRefId: patient.id,
      globalPersonId: input.globalPersonId ?? patient.globalPersonId,
      hotelStayId: input.hotelStayId ?? input.reservationId,
      reservationId: input.reservationId,
      roomNumber: input.roomNumber ?? null,
      patientOrigin: "IN_HOUSE",
      programCode: input.programCode ?? null,
      status: "OPEN",
    },
    include: { patientRef: true, complaints: true, diagnoses: true, labOrders: true },
  });
  await safeInstantiateIntake(created.id);
  return created;
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

  let patient = await prisma.patientRef.findFirst({
    where: { organizationId: input.organizationId, refCode },
  });
  const birthDate = input.birthDate?.trim()
    ? new Date(`${input.birthDate.trim()}T00:00:00.000Z`)
    : undefined;

  if (!patient) {
    patient = await prisma.patientRef.create({
      data: {
        organizationId: input.organizationId,
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
  if (!patient) throw new Error("Failed to ensure patient ref");

  const globalPersonId = await linkPatientGlobalPerson({
    patientRefId: patient.id,
    fin: input.fin,
    fullName: input.fullName,
    phone: input.phone,
    passport: input.passport,
    issuingCountry: input.issuingCountry,
    nationality: input.nationality,
    sex: input.sex,
    birthDate: birthDate ?? input.birthDate,
    globalPersonId: input.globalPersonId,
  });

  const episode = await prisma.clinicalEpisode.create({
    data: {
      patientRefId: patient.id,
      globalPersonId: globalPersonId ?? input.globalPersonId ?? patient.globalPersonId,
      organizationId: input.organizationId,
      patientOrigin: "WALK_IN",
      programCode: input.programCode ?? null,
      status: "OPEN",
    },
    include: { patientRef: true },
  });
  await safeInstantiateIntake(episode.id);
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
  input: { icdCodeId: string; note?: string | null; recordedByUserId?: string | null },
) {
  const { addEpisodeDiagnosis } = await import("@/domain/icd/diagnosis-write.service");
  return addEpisodeDiagnosis(episodeId, input);
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
        organizationId: episode.organizationId || requestOrganizationId(),
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
