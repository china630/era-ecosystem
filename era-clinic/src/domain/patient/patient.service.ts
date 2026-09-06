import { listPersonIdentifiers } from "@era/satellite-kit";
import type { PatientBloodGroup, PatientSex, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { linkPatientGlobalPerson } from "@/lib/patient-identity";
import { requestOrganizationId } from "@/lib/request-organization";
import { patientHasMdmIdentifier } from "@era/clinic-domain";
import {
  ageYearsFromBirthDate,
  parseBirthDateInput,
} from "@/domain/patient/patient-demographics";
import { allocatePatientRefCode } from "@/domain/patient/allocate-patient-ref-code";
import { composeFullName } from "@/domain/patient/patient-ref-code";
import { fillPatientPageDemographicsFromMdm } from "@/domain/patient/mdm-demographics-cache";

export class PatientMdmRequiredError extends Error {
  constructor(message = "Patient must resolve to globalPersonId via FIN or passport with issuing country") {
    super(message);
    this.name = "PatientMdmRequiredError";
  }
}

export class PatientAnamnesisRequiredError extends Error {
  constructor(message = "Anamnesis text is required when updating clinical demographics") {
    super(message);
    this.name = "PatientAnamnesisRequiredError";
  }
}

export type PatientIdentifierInput = {
  finCode?: string;
  passportNumber?: string;
  issuingCountry?: string;
  phone?: string;
};

export type PatientClinicalDemographicsInput = {
  nationality?: string | null;
  sex?: PatientSex;
  birthDate?: string | Date | null;
  bloodGroup?: PatientBloodGroup;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  anamnesisText?: string | null;
};

export type ListPatientsQuery = {
  q?: string;
  sex?: PatientSex;
  bloodGroup?: PatientBloodGroup;
  hasMdm?: 0 | 1;
  ageMin?: number;
  ageMax?: number;
  /** Hotel room on a matching sanatorium episode (Nafta / hotel appliance). */
  roomNumber?: string;
  includeHotelRooms?: boolean;
  programCode?: string;
  includeProgramCodes?: boolean;
  /**
   * Episode course filter. Default OPEN (ops desk).
   * CLOSED = has CLOSED course(s) and no OPEN; ALL = no episode-status constraint.
   */
  episodeStatus?: "OPEN" | "CLOSED" | "ALL";
  page?: number;
  pageSize?: number;
  /**
   * CLI-56 — when set (assigned-only doctor), only patients with this practitioner
   * on an episode care team.
   */
  careTeamPractitionerId?: string;
};

function demographicsWriteData(data: PatientClinicalDemographicsInput) {
  const birthDate =
    typeof data.birthDate === "string" || data.birthDate === null
      ? parseBirthDateInput(data.birthDate as string | null | undefined)
      : data.birthDate;
  return {
    nationality: data.nationality,
    sex: data.sex,
    birthDate,
    bloodGroup: data.bloodGroup,
    emergencyContactName: data.emergencyContactName,
    emergencyContactPhone: data.emergencyContactPhone,
    // CLI-55: do not write anamnesis onto PatientRef (lives on ClinicalEpisode).
  };
}

function withDerivedDemographics<T extends { birthDate?: Date | null }>(row: T) {
  return {
    ...row,
    ageYears: ageYearsFromBirthDate(row.birthDate ?? null),
  };
}

/**
 * Inclusive age filter: age >= ageMin and age <= ageMax.
 * birthDate range is derived from whole years as of today (Asia/Baku calendar day not required for ops filter).
 */
function birthDateRangeForAge(ageMin?: number, ageMax?: number): { gte?: Date; lte?: Date } | undefined {
  if (ageMin == null && ageMax == null) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: { gte?: Date; lte?: Date } = {};
  if (ageMax != null) {
    const oldest = new Date(today);
    oldest.setFullYear(oldest.getFullYear() - ageMax - 1);
    oldest.setDate(oldest.getDate() + 1);
    out.gte = oldest;
  }
  if (ageMin != null) {
    const youngest = new Date(today);
    youngest.setFullYear(youngest.getFullYear() - ageMin);
    out.lte = youngest;
  }
  return out;
}

function clinicalFieldsTouched(data: PatientClinicalDemographicsInput): boolean {
  return (
    data.nationality !== undefined ||
    data.sex !== undefined ||
    data.birthDate !== undefined ||
    data.bloodGroup !== undefined ||
    data.emergencyContactName !== undefined ||
    data.emergencyContactPhone !== undefined
  );
}

export async function listPatients(query?: string) {
  const result = await listPatientsPaged({ q: query });
  return result.items;
}

export async function listProgramCodes(
  episodeStatus: "OPEN" | "CLOSED" | "ALL" = "OPEN",
): Promise<string[]> {
  const episodeWhere =
    episodeStatus === "ALL"
      ? { programCode: { not: null } }
      : { status: episodeStatus, programCode: { not: null } };
  const instanceWhere =
    episodeStatus === "ALL" ? {} : { episode: { status: episodeStatus } };

  const [fromEpisode, fromInstance] = await Promise.all([
    prisma.clinicalEpisode.findMany({
      where: episodeWhere,
      select: { programCode: true },
    }),
    prisma.programInstance.findMany({
      where: instanceWhere,
      select: { programCode: true },
    }),
  ]);

  return [
    ...new Set(
      [...fromEpisode.map((r) => r.programCode), ...fromInstance.map((r) => r.programCode)]
        .map((n) => n?.trim())
        .filter((n): n is string => Boolean(n)),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export async function listHotelRoomNumbers(
  episodeStatus: "OPEN" | "CLOSED" | "ALL" = "OPEN",
): Promise<string[]> {
  const where =
    episodeStatus === "ALL"
      ? { roomNumber: { not: null } }
      : { status: episodeStatus, roomNumber: { not: null } };
  const rows = await prisma.clinicalEpisode.findMany({
    where,
    select: { roomNumber: true },
  });
  return [
    ...new Set(
      rows
        .map((r) => r.roomNumber?.trim())
        .filter((n): n is string => Boolean(n)),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export async function listPatientsPaged(input: ListPatientsQuery = {}) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, input.pageSize ?? 25));
  const where: Prisma.PatientRefWhereInput = {};

  if (input.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { middleName: { contains: q, mode: "insensitive" } },
      { refCode: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }
  if (input.sex) where.sex = input.sex;
  if (input.bloodGroup) where.bloodGroup = input.bloodGroup;
  if (input.hasMdm === 1) where.globalPersonId = { not: null };
  if (input.hasMdm === 0) where.globalPersonId = null;

  const birthRange = birthDateRangeForAge(input.ageMin, input.ageMax);
  if (birthRange) where.birthDate = birthRange;

  // Registry default = entire base; course filters belong on /sanatorium.
  const episodeStatus = input.episodeStatus ?? "ALL";
  const roomNumber = input.roomNumber?.trim();
  const programCode = input.programCode?.trim();

  const episodeSome: Prisma.ClinicalEpisodeWhereInput = {};
  if (episodeStatus === "OPEN") {
    episodeSome.status = "OPEN";
  } else if (episodeStatus === "CLOSED") {
    episodeSome.status = "CLOSED";
  }
  if (roomNumber) {
    episodeSome.roomNumber = { equals: roomNumber, mode: "insensitive" };
  }
  if (programCode) {
    episodeSome.programCode = { equals: programCode, mode: "insensitive" };
  }
  if (input.careTeamPractitionerId) {
    episodeSome.careDoctors = {
      some: { practitionerId: input.careTeamPractitionerId },
    };
  }

  const hasEpisodeSome = Object.keys(episodeSome).length > 0;
  if (episodeStatus === "CLOSED") {
    where.AND = [
      { episodes: { some: episodeSome } },
      { episodes: { none: { status: "OPEN" } } },
    ];
  } else if (hasEpisodeSome) {
    where.episodes = { some: episodeSome };
  }

  const [rawRows, total, hotelRooms, programCodes] = await Promise.all([
    prisma.patientRef.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        episodes: {
          where: { status: "OPEN" },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.patientRef.count({ where }),
    input.includeHotelRooms
      ? listHotelRoomNumbers(episodeStatus)
      : Promise.resolve(undefined),
    input.includeProgramCodes
      ? listProgramCodes(episodeStatus)
      : Promise.resolve(undefined),
  ]);

  // Soft MDM fill for holes on this page only (reception-filled fields stay put).
  const patientsOnly = rawRows.map(({ episodes: _e, ...patient }) => patient);
  const filledPatients = await fillPatientPageDemographicsFromMdm(patientsOnly);
  const openById = new Map(rawRows.map((r) => [r.id, r.episodes.length > 0]));

  return {
    items: filledPatients.map((patient) => ({
      ...withDerivedDemographics(patient),
      hasOpenEpisode: openById.get(patient.id) ?? false,
    })),
    total,
    page,
    pageSize,
    ...(hotelRooms ? { hotelRooms } : {}),
    ...(programCodes ? { programCodes } : {}),
  };
}

export async function getPatient(id: string) {
  const row = await prisma.patientRef.findUnique({ where: { id } });
  if (!row) return null;
  const base = withDerivedDemographics(row);
  if (!row.globalPersonId) {
    return { ...base, identifiersSummary: [] as { type: string; issuingCountry: string | null; isPrimary: boolean }[] };
  }
  const mdm = await listPersonIdentifiers(row.globalPersonId);
  return {
    ...base,
    identifiersSummary: (mdm.identifiers ?? []).map((i) => ({
      type: i.type,
      issuingCountry: i.issuingCountry,
      isPrimary: i.isPrimary,
    })),
  };
}

export async function createPatient(data: {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  fullName?: string;
  phone?: string;
  nationality?: string | null;
  sex?: PatientSex;
  birthDate?: string | null;
  bloodGroup?: PatientBloodGroup;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  finCode?: string;
  passportNumber?: string;
  issuingCountry?: string;
  anamnesisText?: string | null;
}) {
  if (!patientHasMdmIdentifier(data)) {
    throw new PatientMdmRequiredError(
      "Provide FIN or passport with issuing country for MDM resolve",
    );
  }

  const firstName = data.firstName.trim();
  const lastName = data.lastName.trim();
  if (!firstName || !lastName) {
    throw new Error("firstName and lastName are required");
  }
  const middleName = data.middleName?.trim() || null;
  const fullName =
    data.fullName?.trim() || composeFullName({ firstName, lastName, middleName });
  const demo = demographicsWriteData(data);
  const organizationId = requestOrganizationId();

  const patient = await prisma.$transaction(async (tx) => {
    const refCode = await allocatePatientRefCode(tx, organizationId);
    return tx.patientRef.create({
      data: {
        organizationId,
        refCode,
        firstName,
        lastName,
        middleName,
        fullName,
        phone: data.phone,
        nationality: demo.nationality ?? null,
        sex: demo.sex,
        birthDate: demo.birthDate === undefined ? undefined : demo.birthDate,
        bloodGroup: demo.bloodGroup,
        emergencyContactName: demo.emergencyContactName ?? undefined,
        emergencyContactPhone: demo.emergencyContactPhone ?? undefined,
      },
    });
  });

  const globalPersonId = await linkPatientGlobalPerson({
    patientRefId: patient.id,
    fin: data.finCode,
    firstName,
    middleName: middleName ?? undefined,
    lastName,
    fullName,
    phone: data.phone,
    passport: data.passportNumber,
    issuingCountry: data.issuingCountry,
    nationality: data.nationality ?? undefined,
    sex: demo.sex,
    birthDate: demo.birthDate ?? undefined,
  });

  const updated = await prisma.patientRef.findUniqueOrThrow({
    where: { id: patient.id },
  });

  if (!updated.globalPersonId && !globalPersonId) {
    await prisma.patientRef.delete({ where: { id: patient.id } });
    throw new PatientMdmRequiredError();
  }

  return withDerivedDemographics(updated);
}

export async function updatePatient(
  id: string,
  data: {
    firstName?: string;
    lastName?: string;
    middleName?: string | null;
    fullName?: string;
    phone?: string | null;
    nationality?: string | null;
    sex?: PatientSex;
    birthDate?: string | null;
    bloodGroup?: PatientBloodGroup;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    finCode?: string | null;
    passportNumber?: string | null;
    issuingCountry?: string | null;
    anamnesisText?: string | null;
  },
) {
  // CLI-55: anamnesis is episode-scoped; demographics PATCH no longer requires it.

  const identityInput: PatientIdentifierInput = {
    finCode: data.finCode ?? undefined,
    passportNumber: data.passportNumber ?? undefined,
    issuingCountry: data.issuingCountry ?? undefined,
    phone: data.phone ?? undefined,
  };
  const identityTouched =
    data.finCode !== undefined ||
    data.passportNumber !== undefined ||
    data.issuingCountry !== undefined ||
    data.phone !== undefined;
  const demographicsTouched = data.sex !== undefined || data.birthDate !== undefined;

  const existing = await prisma.patientRef.findUniqueOrThrow({ where: { id } });
  const firstName =
    data.firstName !== undefined ? data.firstName.trim() : existing.firstName;
  const lastName =
    data.lastName !== undefined ? data.lastName.trim() : existing.lastName;
  const middleName =
    data.middleName !== undefined
      ? data.middleName?.trim() || null
      : existing.middleName;
  const nameTouched =
    data.firstName !== undefined ||
    data.lastName !== undefined ||
    data.middleName !== undefined;
  const fullName = nameTouched
    ? composeFullName({ firstName, lastName, middleName })
    : data.fullName !== undefined
      ? data.fullName.trim()
      : existing.fullName;

  const demo = demographicsWriteData(data);
  const updated = await prisma.patientRef.update({
    where: { id },
    data: {
      ...(nameTouched
        ? { firstName, lastName, middleName, fullName }
        : data.fullName !== undefined
          ? { fullName }
          : {}),
      phone: data.phone,
      nationality: demo.nationality,
      sex: demo.sex,
      birthDate: demo.birthDate === undefined ? undefined : demo.birthDate,
      bloodGroup: demo.bloodGroup,
      emergencyContactName: demo.emergencyContactName,
      emergencyContactPhone: demo.emergencyContactPhone,
    },
  });

  if (identityTouched || demographicsTouched || nameTouched) {
    const globalPersonId = await linkPatientGlobalPerson({
      patientRefId: id,
      fin: identityInput.finCode,
      firstName: updated.firstName,
      middleName: updated.middleName ?? undefined,
      lastName: updated.lastName,
      fullName: updated.fullName,
      phone: identityInput.phone ?? updated.phone ?? undefined,
      passport: identityInput.passportNumber,
      issuingCountry: identityInput.issuingCountry,
      nationality: updated.nationality ?? undefined,
      sex: updated.sex,
      birthDate: updated.birthDate,
      globalPersonId: updated.globalPersonId,
    });
    const withMdm = await prisma.patientRef.findUniqueOrThrow({ where: { id } });
    if (identityTouched && !withMdm.globalPersonId && !globalPersonId) {
      throw new PatientMdmRequiredError();
    }
    return getPatient(id);
  }

  return withDerivedDemographics(updated);
}
