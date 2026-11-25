import { prisma } from "@/lib/prisma";
import { splitFullNameToParts } from "@era/satellite-kit";
import { allocatePatientRefCode } from "@/domain/patient/allocate-patient-ref-code";
import { composeFullName } from "@/domain/patient/patient-ref-code";
import { linkPatientGlobalPerson } from "@/lib/patient-identity";
import { fetchWorkforcePicker } from "@/lib/workforce-picker";
import { addBakuDays, bakuDateKey, parseBakuDateTime, todayBakuYmd } from "@/lib/baku-day";
import { instantiateProgramFromTemplate } from "@/lib/sanatorium-scheduler.service";

export class StaffBenefitCourseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = "StaffBenefitCourseError";
  }
}

const DEFAULT_PROGRAM = "PKG-STANDART";

export function requireCpEmploymentId(raw: string): string {
  const employmentId = raw.trim();
  if (!employmentId) {
    throw new StaffBenefitCourseError("cpEmploymentId required", "EMPLOYMENT_REQUIRED", 400);
  }
  return employmentId;
}

export function validateStaffBenefitCourseDays(courseDays: number): number {
  const days = Math.floor(courseDays);
  if (!Number.isFinite(days) || days < 1 || days > 31) {
    throw new StaffBenefitCourseError("courseDays must be 1…31", "INVALID_COURSE_DAYS", 400);
  }
  return days;
}

export function assertStaffBenefitProgramAllowed(programCode: string): string {
  const code = (programCode.trim() || DEFAULT_PROGRAM).toUpperCase();
  if (code !== "PKG-STANDART") {
    throw new StaffBenefitCourseError(
      "Staff benefit v1 allows PKG-STANDART only",
      "STAFF_PROGRAM_NOT_ALLOWED",
      400,
    );
  }
  return code;
}

function splitDisplayName(name: string) {
  const parts = splitFullNameToParts(name);
  const firstName = (parts.firstName ?? name.split(/\s+/)[0] ?? name).trim();
  const lastName = (
    parts.lastName ??
    name.trim().split(/\s+/).slice(-1)[0] ??
    firstName
  ).trim();
  const middleName = parts.middleName?.trim() || null;
  return {
    firstName,
    lastName,
    middleName,
    fullName: composeFullName({ firstName, lastName, middleName }) || name.trim(),
  };
}

/**
 * Open a WALK_IN STAFF_BENEFIT course with PKG-STANDART from an active CP employment.
 * No hotel stay / from-stay. Person must come from workforce picker.
 */
export async function openStaffBenefitCourse(input: {
  organizationId: string;
  cpEmploymentId: string;
  courseDays: number;
  startsOnYmd?: string;
  programCode?: string;
  openedByUserId?: string;
}) {
  const employmentId = requireCpEmploymentId(input.cpEmploymentId);
  const days = validateStaffBenefitCourseDays(input.courseDays);
  const programCode = assertStaffBenefitProgramAllowed(input.programCode ?? DEFAULT_PROGRAM);

  const picker = await fetchWorkforcePicker(input.organizationId);
  if (picker.unavailable) {
    throw new StaffBenefitCourseError(
      "Workforce picker unavailable",
      "WORKFORCE_UNAVAILABLE",
      503,
    );
  }
  const employment = picker.items.find((row) => row.id === employmentId);
  if (!employment) {
    throw new StaffBenefitCourseError(
      "Employment not active or not in this organization",
      "EMPLOYMENT_NOT_ACTIVE",
      409,
    );
  }

  const names = splitDisplayName(employment.name);
  let patient = await prisma.patientRef.findFirst({
    where: {
      organizationId: input.organizationId,
      globalPersonId: employment.globalPersonId,
    },
  });
  if (!patient) {
    patient = await prisma.$transaction(async (tx) => {
      const refCode = await allocatePatientRefCode(tx, input.organizationId);
      return tx.patientRef.create({
        data: {
          organizationId: input.organizationId,
          refCode,
          firstName: names.firstName,
          lastName: names.lastName,
          middleName: names.middleName,
          fullName: names.fullName,
          globalPersonId: employment.globalPersonId,
          sex: "UNKNOWN",
        },
      });
    });
  }

  const existingOpen = await prisma.clinicalEpisode.findFirst({
    where: { patientRefId: patient.id, status: "OPEN" },
    select: { id: true, courseKind: true },
  });
  if (existingOpen) {
    throw new StaffBenefitCourseError(
      "Patient already has an open walk-in episode",
      "WALK_IN_OPEN_EXISTS",
      409,
    );
  }

  await linkPatientGlobalPerson({
    patientRefId: patient.id,
    firstName: names.firstName,
    lastName: names.lastName,
    middleName: names.middleName ?? undefined,
    fullName: names.fullName,
    globalPersonId: employment.globalPersonId,
  });

  const startYmd = (input.startsOnYmd?.trim() || todayBakuYmd()).slice(0, 10);
  const endYmd = addBakuDays(startYmd, days);
  const startsOn = parseBakuDateTime(startYmd, "09:00");
  const endsOn = parseBakuDateTime(endYmd, "09:00");

  const episode = await prisma.clinicalEpisode.create({
    data: {
      patientRefId: patient.id,
      globalPersonId: employment.globalPersonId,
      organizationId: input.organizationId,
      patientOrigin: "WALK_IN",
      courseKind: "STAFF_BENEFIT",
      benefitEmploymentId: employmentId,
      programCode,
      plannedEndsOn: endsOn,
      status: "OPEN",
    },
    include: { patientRef: true },
  });

  const instance = await instantiateProgramFromTemplate({
    episodeId: episode.id,
    programCode,
    startsOn,
    checkInDate: startsOn,
    checkOutDate: endsOn,
    nights: days,
    skipAutoStudies: true,
  });

  return {
    episode,
    programInstance: instance,
    employment: {
      id: employment.id,
      name: employment.name,
      positionName: employment.positionName,
      orgUnitName: employment.orgUnitName,
    },
    startsOnYmd: bakuDateKey(startsOn),
    endsOnYmd: bakuDateKey(endsOn),
    courseDays: days,
    openedByUserId: input.openedByUserId ?? null,
  };
}
