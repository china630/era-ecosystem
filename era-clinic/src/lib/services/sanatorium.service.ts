import { prisma } from '@/lib/prisma';
import { instantiateProgramFromTemplate } from '@/lib/sanatorium-scheduler.service';
import { requestOrganizationId } from '@/lib/request-organization';
import { linkPatientGlobalPerson } from '@/lib/patient-identity';
import { getPersonOpsProfile, normalizePersonSex, parsePersonBirthDate, splitFullNameToParts } from '@era/satellite-kit';
import { instantiateIntakePackage } from '@/domain/patient/instantiate-intake.service';
import {
  assertLabOrderCanCreate,
  findEpisodeLabConflict,
} from '@/domain/lab/lab-order-conflict.service';
import { allocatePatientRefCode } from '@/domain/patient/allocate-patient-ref-code';
import { composeFullName } from '@/domain/patient/patient-ref-code';
import { episodeAssignedToPractitionerWhere } from '@/lib/auth/clinic-data-scope';

function refCodeFromPassport(passport: string): string {
  return `HOTEL-${passport.replace(/\s+/g, '-').slice(0, 24)}`;
}

/** Wave E — legacy lookup key only (new creates use allocatePatientRefCode). */
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
  const namePatch: {
    firstName?: string;
    middleName?: string | null;
    lastName?: string;
    fullName?: string;
  } = {};
  if (profile.firstName?.trim() && !patient.firstName?.trim()) {
    namePatch.firstName = profile.firstName.trim();
  }
  if (profile.middleName?.trim() && !patient.middleName?.trim()) {
    namePatch.middleName = profile.middleName.trim();
  }
  if (profile.lastName?.trim() && !patient.lastName?.trim()) {
    namePatch.lastName = profile.lastName.trim();
  }
  if (Object.keys(namePatch).length > 0) {
    namePatch.fullName = composeFullName({
      firstName: namePatch.firstName ?? patient.firstName,
      middleName: namePatch.middleName ?? patient.middleName,
      lastName: namePatch.lastName ?? patient.lastName,
    });
  }
  await prisma.patientRef.update({
    where: { id: patientId },
    data: {
      ...(nextSex && patient.sex === "UNKNOWN" ? { sex: nextSex } : {}),
      ...(!patient.birthDate && birthDate ? { birthDate } : {}),
      globalPersonId: globalPersonId.trim(),
      ...namePatch,
    },
  });
}

function walkInLegacyRefCode(finOrPassport: string): string {
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
  const legacyRef = resolveHotelPatientRefCode({
    reservationId: input.reservationId,
    globalPersonId: input.globalPersonId,
    paxKey: input.paxKey,
    passportNumber: input.passportNumber,
  });

  let patient = await prisma.patientRef.findFirst({
    where: {
      organizationId: input.organizationId,
      OR: [
        ...(input.globalPersonId?.trim()
          ? [{ globalPersonId: input.globalPersonId.trim() }]
          : []),
        { refCode: legacyRef },
      ],
    },
  });

  if (!patient) {
    patient = await prisma.$transaction(async (tx) => {
      const refCode = await allocatePatientRefCode(tx, input.organizationId);
      const parts = splitFullNameToParts(input.guestName);
      const firstName = parts.firstName ?? input.guestName;
      const lastName = parts.lastName ?? "";
      const middleName = parts.middleName;
      const fullName =
        composeFullName({ firstName, lastName, middleName }) || input.guestName.trim();
      return tx.patientRef.create({
        data: {
          organizationId: input.organizationId,
          refCode,
          firstName,
          lastName,
          middleName,
          fullName,
          phone: input.phone ?? null,
          globalPersonId: input.globalPersonId ?? null,
        },
      });
    });
  }

  if (!patient) throw new Error("Failed to create hotel stay patient");

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
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
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
  const legacyRef = walkInLegacyRefCode(key);

  const split = splitFullNameToParts(input.fullName);
  const firstName = (input.firstName ?? split.firstName ?? input.fullName.split(/\s+/)[0] ?? "").trim();
  const lastName = (
    input.lastName ??
    split.lastName ??
    input.fullName.trim().split(/\s+/).slice(-1)[0] ??
    ""
  ).trim();
  const middleName =
    input.middleName !== undefined
      ? input.middleName?.trim() || null
      : split.middleName;
  const fullName =
    input.fullName.trim() ||
    composeFullName({ firstName, lastName, middleName });

  let patient = await prisma.patientRef.findFirst({
    where: {
      organizationId: input.organizationId,
      OR: [
        ...(input.globalPersonId?.trim()
          ? [{ globalPersonId: input.globalPersonId.trim() }]
          : []),
        { refCode: legacyRef },
        ...(input.phone?.trim()
          ? [{ phone: input.phone.trim() }]
          : []),
      ],
    },
  });
  const birthDate = input.birthDate?.trim()
    ? new Date(`${input.birthDate.trim()}T00:00:00.000Z`)
    : undefined;

  if (!patient) {
    patient = await prisma.$transaction(async (tx) => {
      const refCode = await allocatePatientRefCode(tx, input.organizationId);
      return tx.patientRef.create({
        data: {
          organizationId: input.organizationId,
          refCode,
          firstName: firstName || fullName,
          lastName,
          middleName,
          fullName,
          phone: input.phone ?? null,
          nationality: input.nationality?.trim() || null,
          sex: input.sex,
          birthDate: birthDate ?? null,
          globalPersonId: input.globalPersonId ?? null,
        },
      });
    });
  } else {
    patient = await prisma.patientRef.update({
      where: { id: patient.id },
      data: {
        firstName: firstName || patient.firstName,
        lastName: lastName || patient.lastName,
        ...(middleName !== undefined ? { middleName } : {}),
        fullName,
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        ...(input.nationality?.trim() ? { nationality: input.nationality.trim() } : {}),
        sex: input.sex,
        ...(birthDate !== undefined ? { birthDate } : {}),
        ...(input.globalPersonId ? { globalPersonId: input.globalPersonId } : {}),
      },
    });
  }
  if (!patient) throw new Error("Failed to ensure patient ref");

  const existingOpen = await prisma.clinicalEpisode.findFirst({
    where: { patientRefId: patient.id, status: "OPEN" },
    select: { id: true },
  });
  if (existingOpen) {
    const err = new Error("Patient already has an open walk-in episode");
    (err as Error & { code?: string }).code = "WALK_IN_OPEN_EXISTS";
    throw err;
  }

  const globalPersonId = await linkPatientGlobalPerson({
    patientRefId: patient.id,
    fin: input.fin,
    firstName,
    middleName: middleName ?? undefined,
    lastName,
    fullName,
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
  const { episodeAnamnesisDenied, ANAMNESIS_REQUIRED } = await import(
    "@/domain/sanatorium/episode-gates"
  );
  const anamnesisDenied = episodeAnamnesisDenied(episode.anamnesisText);
  if (anamnesisDenied) {
    const err = new Error(anamnesisDenied);
    (err as Error & { code?: string }).code = ANAMNESIS_REQUIRED;
    throw err;
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

export async function listOpenEpisodes(input?: {
  organizationId?: string;
  page?: number;
  pageSize?: number;
  q?: string;
  origin?: string;
  roomNumber?: string;
  programCode?: string;
  includeHotelRooms?: boolean;
  includeProgramCodes?: boolean;
  /** Layer-2 data scope (omit / ALL = no row filter). */
  dataScope?: { mode: "ALL" | "ASSIGNED"; practitionerId: string | null };
}) {
  const page = input?.page ?? 1;
  const pageSize = input?.pageSize ?? 25;
  const roomNumber = input?.roomNumber?.trim();
  const programCode = input?.programCode?.trim();

  if (
    input?.dataScope?.mode === "ASSIGNED" &&
    !input.dataScope.practitionerId
  ) {
    return {
      data: [],
      total: 0,
      page,
      pageSize,
    };
  }

  const scopeFilter =
    input?.dataScope?.mode === "ASSIGNED" && input.dataScope.practitionerId
      ? episodeAssignedToPractitionerWhere(input.dataScope.practitionerId)
      : undefined;

  const where = {
    status: 'OPEN' as const,
    ...(input?.organizationId ? { organizationId: input.organizationId } : {}),
    ...(input?.origin ? { patientOrigin: input.origin as 'IN_HOUSE' | 'WALK_IN' } : {}),
    ...(roomNumber
      ? { roomNumber: { equals: roomNumber, mode: 'insensitive' as const } }
      : {}),
    ...(programCode
      ? { programCode: { equals: programCode, mode: 'insensitive' as const } }
      : {}),
    ...(input?.q?.trim()
      ? {
          OR: [
            { patientRef: { fullName: { contains: input.q.trim(), mode: 'insensitive' as const } } },
            { patientRef: { refCode: { contains: input.q.trim(), mode: 'insensitive' as const } } },
            { roomNumber: { contains: input.q.trim(), mode: 'insensitive' as const } },
            { programCode: { contains: input.q.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(scopeFilter ? { AND: [scopeFilter] } : {}),
  };

  const { listHotelRoomNumbers, listProgramCodes } = await import(
    '@/domain/patient/patient.service'
  );

  const [total, episodes, hotelRooms, programCodes] = await Promise.all([
    prisma.clinicalEpisode.count({ where }),
    prisma.clinicalEpisode.findMany({
      where,
      include: {
        patientRef: true,
        complaints: { orderBy: { recordedAt: 'desc' }, take: 3 },
        diagnoses: {
          orderBy: { recordedAt: 'desc' },
          take: 3,
          include: { icdCode: true },
        },
        labOrders: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            items: {
              include: {
                diagnosticService: {
                  select: {
                    code: true,
                    serviceCode: true,
                    titleEn: true,
                    titleRu: true,
                    titleAz: true,
                  },
                },
              },
            },
          },
        },
        programInstance: {
          include: { procedureLines: { orderBy: { procedureCode: 'asc' } } },
        },
      },
      orderBy: { openedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    input?.includeHotelRooms
      ? listHotelRoomNumbers('OPEN')
      : Promise.resolve(undefined),
    input?.includeProgramCodes
      ? listProgramCodes('OPEN')
      : Promise.resolve(undefined),
  ]);

  const {
    LIVE_PROCEDURE_STATUSES,
    OPEN_LAB_STATUSES,
    walkInCloseDenied,
  } = await import("@/domain/sanatorium/episode-gates");

  const walkInIds = episodes
    .filter((e) => e.patientOrigin === "WALK_IN")
    .map((e) => e.id);
  if (walkInIds.length === 0) {
    const data = episodes.map((e) => ({ ...e, canCloseWalkIn: false as boolean }));
    return {
      data,
      total,
      page,
      pageSize,
      ...(hotelRooms ? { hotelRooms } : {}),
      ...(programCodes ? { programCodes } : {}),
    };
  }

  const [liveProcs, openLabs] = await Promise.all([
    prisma.procedureOrder.groupBy({
      by: ["clinicalEpisodeId"],
      where: {
        clinicalEpisodeId: { in: walkInIds },
        status: { in: [...LIVE_PROCEDURE_STATUSES] },
      },
      _count: { _all: true },
    }),
    prisma.labOrder.groupBy({
      by: ["clinicalEpisodeId"],
      where: {
        clinicalEpisodeId: { in: walkInIds },
        status: { in: [...OPEN_LAB_STATUSES] },
      },
      _count: { _all: true },
    }),
  ]);
  const liveByEp = new Map(
    liveProcs
      .filter((r) => r.clinicalEpisodeId)
      .map((r) => [r.clinicalEpisodeId!, r._count._all]),
  );
  const labsByEp = new Map(
    openLabs
      .filter((r) => r.clinicalEpisodeId)
      .map((r) => [r.clinicalEpisodeId!, r._count._all]),
  );

  const data = episodes.map((e) => {
    if (e.patientOrigin !== "WALK_IN") {
      return { ...e, canCloseWalkIn: false };
    }
    const denied = walkInCloseDenied({
      liveProcedureCount: liveByEp.get(e.id) ?? 0,
      openLabCount: labsByEp.get(e.id) ?? 0,
    });
    return { ...e, canCloseWalkIn: !denied };
  });
  return {
    data,
    total,
    page,
    pageSize,
    ...(hotelRooms ? { hotelRooms } : {}),
    ...(programCodes ? { programCodes } : {}),
  };
}

/** @deprecated use listOpenEpisodes */
export async function listInHouseEpisodes(organizationId?: string) {
  const result = await listOpenEpisodes({ organizationId });
  return result.data;
}

export async function addComplaint(episodeId: string, text: string) {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    select: { status: true },
  });
  if (!episode) {
    const err = new Error("Episode not found");
    (err as Error & { code?: string }).code = "NO_OPEN_EPISODE";
    throw err;
  }
  const { episodeWriteDenied, EPISODE_CLOSED } = await import(
    "@/domain/sanatorium/episode-gates"
  );
  const closed = episodeWriteDenied(episode.status);
  if (closed) {
    const err = new Error(closed);
    (err as Error & { code?: string }).code = EPISODE_CLOSED;
    throw err;
  }
  return prisma.clinicalComplaint.create({
    data: { episodeId, text },
  });
}

export async function listEpisodeComplaints(episodeId: string) {
  return prisma.clinicalComplaint.findMany({
    where: { episodeId },
    orderBy: { recordedAt: "desc" },
  });
}

export async function deleteEpisodeComplaint(id: string, patientRefId: string) {
  const row = await prisma.clinicalComplaint.findUnique({
    where: { id },
    include: { episode: { select: { patientRefId: true, status: true } } },
  });
  if (!row || row.episode.patientRefId !== patientRefId) {
    throw new Error("Complaint not found");
  }
  const { episodeWriteDenied, EPISODE_CLOSED } = await import(
    "@/domain/sanatorium/episode-gates"
  );
  const closed = episodeWriteDenied(row.episode.status);
  if (closed) {
    const err = new Error(closed);
    (err as Error & { code?: string }).code = EPISODE_CLOSED;
    throw err;
  }
  await prisma.clinicalComplaint.delete({ where: { id } });
}

export async function updateEpisodeComplaint(
  id: string,
  patientRefId: string,
  text: string,
) {
  const row = await prisma.clinicalComplaint.findUnique({
    where: { id },
    include: { episode: { select: { patientRefId: true, status: true } } },
  });
  if (!row || row.episode.patientRefId !== patientRefId) {
    throw new Error("Complaint not found");
  }
  const { episodeWriteDenied, EPISODE_CLOSED } = await import(
    "@/domain/sanatorium/episode-gates"
  );
  const closed = episodeWriteDenied(row.episode.status);
  if (closed) {
    const err = new Error(closed);
    (err as Error & { code?: string }).code = EPISODE_CLOSED;
    throw err;
  }
  return prisma.clinicalComplaint.update({
    where: { id },
    data: { text: text.trim() },
  });
}

export async function addDiagnosis(
  episodeId: string,
  input: { icdCodeId: string; note?: string | null; recordedByUserId?: string | null },
) {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    select: { status: true },
  });
  if (!episode) throw new Error("Episode not found");
  const { episodeWriteDenied, EPISODE_CLOSED } = await import(
    "@/domain/sanatorium/episode-gates"
  );
  const closed = episodeWriteDenied(episode.status);
  if (closed) {
    const err = new Error(closed);
    (err as Error & { code?: string }).code = EPISODE_CLOSED;
    throw err;
  }
  const { addEpisodeDiagnosis } = await import("@/domain/icd/diagnosis-write.service");
  return addEpisodeDiagnosis(episodeId, input);
}

export async function createEpisodeLabOrder(
  episodeId: string,
  testCode: string,
  options?: { confirmRepeat?: boolean },
) {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    include: { patientRef: true },
  });
  if (!episode?.patientRefId) throw new Error('Episode patient not found');
  const { episodeWriteDenied, EPISODE_CLOSED } = await import(
    "@/domain/sanatorium/episode-gates"
  );
  const closed = episodeWriteDenied(episode.status);
  if (closed) {
    const err = new Error(closed);
    (err as Error & { code?: string }).code = EPISODE_CLOSED;
    throw err;
  }

  const conflict = await findEpisodeLabConflict(episodeId, [testCode]);
  assertLabOrderCanCreate(conflict, options?.confirmRepeat);

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
      labOrders: {
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              diagnosticService: {
                select: {
                  code: true,
                  serviceCode: true,
                  titleEn: true,
                  titleRu: true,
                  titleAz: true,
                },
              },
            },
          },
        },
      },
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
      scheduledAt: { gte: from, lt: to },
      OR: [
        { clinicalEpisodeId: episodeId },
        // Pre-migration / orphan rows: fall back to patient+date
        { clinicalEpisodeId: null, patientRefId: episode.patientRefId },
      ],
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

/**
 * Close an idle WALK_IN episode. Refuses IN_HOUSE (use hotel checkout)
 * and refuses when live procedures or open labs remain — does not cancel leftovers.
 */
export async function closeWalkInEpisode(episodeId: string) {
  const {
    EPISODE_NOT_IDLE,
    LIVE_PROCEDURE_STATUSES,
    OPEN_LAB_STATUSES,
    walkInCloseDenied,
  } = await import("@/domain/sanatorium/episode-gates");

  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    select: {
      id: true,
      status: true,
      patientOrigin: true,
      patientRefId: true,
    },
  });
  if (!episode) {
    const err = new Error("Episode not found");
    (err as Error & { code?: string }).code = "NO_OPEN_EPISODE";
    throw err;
  }
  if (episode.status !== "OPEN") {
    const err = new Error("Episode is already closed");
    (err as Error & { code?: string }).code = "EPISODE_CLOSED";
    throw err;
  }
  if (episode.patientOrigin !== "WALK_IN") {
    const err = new Error("IN_HOUSE episodes close via hotel checkout");
    (err as Error & { code?: string }).code = "EPISODE_CLOSED";
    throw err;
  }

  const [liveProcedureCount, openLabCount] = await Promise.all([
    prisma.procedureOrder.count({
      where: {
        clinicalEpisodeId: episodeId,
        status: { in: [...LIVE_PROCEDURE_STATUSES] },
      },
    }),
    prisma.labOrder.count({
      where: {
        clinicalEpisodeId: episodeId,
        status: { in: [...OPEN_LAB_STATUSES] },
      },
    }),
  ]);

  const denied = walkInCloseDenied({ liveProcedureCount, openLabCount });
  if (denied) {
    const err = new Error(denied);
    (err as Error & { code?: string }).code = EPISODE_NOT_IDLE;
    throw err;
  }

  return prisma.clinicalEpisode.update({
    where: { id: episodeId },
    data: { status: "CLOSED", closedAt: new Date() },
  });
}

/** Cron helper: close idle OPEN walk-in episodes for the current tenant. */
export async function closeIdleWalkInEpisodes(): Promise<{ closed: number; skipped: number }> {
  const open = await prisma.clinicalEpisode.findMany({
    where: { status: "OPEN", patientOrigin: "WALK_IN" },
    select: { id: true },
  });
  let closed = 0;
  let skipped = 0;
  for (const ep of open) {
    try {
      await closeWalkInEpisode(ep.id);
      closed++;
    } catch {
      skipped++;
    }
  }
  return { closed, skipped };
}
