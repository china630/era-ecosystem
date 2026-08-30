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

export class PatientMdmRequiredError extends Error {
  constructor(message = "Patient must resolve to globalPersonId via FIN, passport, or MDM") {
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
  /** Hotel room on an OPEN sanatorium episode (Nafta / hotel appliance). */
  roomNumber?: string;
  includeHotelRooms?: boolean;
  programCode?: string;
  includeProgramCodes?: boolean;
  page?: number;
  pageSize?: number;
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

export async function listProgramCodes(): Promise<string[]> {
  const rows = await prisma.clinicalEpisode.findMany({
    where: { status: "OPEN", programCode: { not: null } },
    select: { programCode: true },
  });
  return [
    ...new Set(
      rows
        .map((r) => r.programCode?.trim())
        .filter((n): n is string => Boolean(n)),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export async function listHotelRoomNumbers(): Promise<string[]> {
  const rows = await prisma.clinicalEpisode.findMany({
    where: { status: "OPEN", roomNumber: { not: null } },
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

  const roomNumber = input.roomNumber?.trim();
  if (roomNumber) {
    where.episodes = {
      some: {
        status: "OPEN",
        roomNumber: { equals: roomNumber, mode: "insensitive" },
      },
    };
  }
  const programCode = input.programCode?.trim();
  if (programCode) {
    where.episodes = {
      some: {
        ...(where.episodes && "some" in where.episodes ? where.episodes.some : {}),
        status: "OPEN",
        programCode: { equals: programCode, mode: "insensitive" },
      },
    };
  }

  const [rows, total, hotelRooms, programCodes] = await Promise.all([
    prisma.patientRef.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        episodes: {
          where: { status: "OPEN" },
          select: { roomNumber: true, programCode: true },
          orderBy: { openedAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.patientRef.count({ where }),
    input.includeHotelRooms ? listHotelRoomNumbers() : Promise.resolve(undefined),
    input.includeProgramCodes ? listProgramCodes() : Promise.resolve(undefined),
  ]);

  return {
    items: rows.map((row) => {
      const { episodes, ...patient } = row;
      return {
        ...withDerivedDemographics(patient),
        hotelRoomNumber: episodes[0]?.roomNumber ?? null,
        programCode: episodes[0]?.programCode ?? null,
      };
    }),
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
  refCode: string;
  fullName: string;
  phone?: string;
  nationality?: string;
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
      "Provide FIN, passport with issuing country, or phone for MDM resolve",
    );
  }

  const demo = demographicsWriteData(data);
  const patient = await prisma.patientRef.create({
    data: {
      organizationId: requestOrganizationId(),
      refCode: data.refCode,
      fullName: data.fullName,
      phone: data.phone,
      nationality: demo.nationality ?? undefined,
      sex: demo.sex,
      birthDate: demo.birthDate === undefined ? undefined : demo.birthDate,
      bloodGroup: demo.bloodGroup,
      emergencyContactName: demo.emergencyContactName ?? undefined,
      emergencyContactPhone: demo.emergencyContactPhone ?? undefined,
    },
  });

  const globalPersonId = await linkPatientGlobalPerson({
    patientRefId: patient.id,
    fin: data.finCode,
    fullName: data.fullName,
    phone: data.phone,
    passport: data.passportNumber,
    issuingCountry: data.issuingCountry,
    nationality: data.nationality,
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

  const demo = demographicsWriteData(data);
  const updated = await prisma.patientRef.update({
    where: { id },
    data: {
      fullName: data.fullName,
      phone: data.phone,
      nationality: demo.nationality,
      sex: demo.sex,
      birthDate: demo.birthDate === undefined ? undefined : demo.birthDate,
      bloodGroup: demo.bloodGroup,
      emergencyContactName: demo.emergencyContactName,
      emergencyContactPhone: demo.emergencyContactPhone,
    },
  });

  if (identityTouched || demographicsTouched) {
    const globalPersonId = await linkPatientGlobalPerson({
      patientRefId: id,
      fin: identityInput.finCode,
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
