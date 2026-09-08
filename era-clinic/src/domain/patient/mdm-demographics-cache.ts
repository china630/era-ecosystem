import {
  ensurePersonAccessGrant,
  getPersonOpsProfile,
  normalizePersonSex,
  parsePersonBirthDate,
  type PersonOpsProfile,
} from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { composeFullName } from "@/domain/patient/patient-ref-code";
import { requestOrganizationId } from "@/lib/request-organization";

export type PatientDemographicsCacheRow = {
  id: string;
  globalPersonId: string | null;
  sex: string | null;
  birthDate: Date | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  fullName: string;
};

function sexNeedsFill(sex: string | null | undefined): boolean {
  return !sex || sex === "UNKNOWN";
}

/** Rows with MDM link and missing required demographics — reception-filled rows stay out. */
export function patientNeedsMdmDemographicsFill(
  row: PatientDemographicsCacheRow,
): boolean {
  if (!row.globalPersonId?.trim()) return false;
  if (sexNeedsFill(row.sex)) return true;
  if (!row.birthDate) return true;
  if (!row.firstName?.trim() || !row.lastName?.trim()) return true;
  return false;
}

export type PatientDemographicsFillPatch = {
  sex?: "MALE" | "FEMALE";
  birthDate?: Date;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  fullName?: string;
  globalPersonId?: string;
};

/** Fill-not-clear patch from MDM ops-profile. Null = nothing to write. */
export function buildPatientDemographicsFillPatch(
  patient: PatientDemographicsCacheRow,
  profile: Pick<
    PersonOpsProfile,
    "firstName" | "middleName" | "lastName" | "sex" | "birthDate" | "accessDenied"
  > & { globalPersonId?: string },
): PatientDemographicsFillPatch | null {
  if (profile.accessDenied) return null;
  const patch: PatientDemographicsFillPatch = {};
  const sex = normalizePersonSex(profile.sex);
  if ((sex === "MALE" || sex === "FEMALE") && sexNeedsFill(patient.sex)) {
    patch.sex = sex;
  }
  const birthDate = parsePersonBirthDate(profile.birthDate);
  if (!patient.birthDate && birthDate) {
    patch.birthDate = birthDate;
  }
  if (profile.firstName?.trim() && !patient.firstName?.trim()) {
    patch.firstName = profile.firstName.trim();
  }
  if (profile.middleName?.trim() && !patient.middleName?.trim()) {
    patch.middleName = profile.middleName.trim();
  }
  if (profile.lastName?.trim() && !patient.lastName?.trim()) {
    patch.lastName = profile.lastName.trim();
  }
  if (patch.firstName || patch.middleName !== undefined || patch.lastName) {
    patch.fullName = composeFullName({
      firstName: patch.firstName ?? patient.firstName ?? "",
      middleName: patch.middleName !== undefined ? patch.middleName : patient.middleName,
      lastName: patch.lastName ?? patient.lastName ?? "",
    });
  }
  const gpid = profile.globalPersonId?.trim() || patient.globalPersonId?.trim();
  if (gpid && gpid !== patient.globalPersonId) {
    patch.globalPersonId = gpid;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

async function persistFill(
  patientId: string,
  patch: PatientDemographicsFillPatch,
): Promise<void> {
  await prisma.patientRef.update({
    where: { id: patientId },
    data: patch,
  });
}

function clinicOrganizationId(): string | undefined {
  try {
    return requestOrganizationId();
  } catch {
    return undefined;
  }
}

/**
 * Ops-profile with org grant. Existing PatientRef.globalPersonId implies
 * operational need — ensure PersonAccessGrant then re-read when denied.
 */
export async function fetchOpsProfileForPatientFill(
  globalPersonId: string,
  organizationId?: string | null,
): Promise<PersonOpsProfile | null> {
  const gpid = globalPersonId.trim();
  if (!gpid) return null;
  const orgId = organizationId?.trim() || clinicOrganizationId();
  let profile = await getPersonOpsProfile(gpid, {
    ...(orgId ? { organizationId: orgId } : {}),
  });
  if (!profile) return null;
  if (profile.accessDenied && orgId) {
    const granted = await ensurePersonAccessGrant(gpid, orgId);
    if (!granted) return profile;
    profile = await getPersonOpsProfile(gpid, { organizationId: orgId });
  }
  return profile;
}

/** Single-person fill (check-in / episode open). */
export async function applyMdmDemographicsCache(
  patientId: string,
  globalPersonId: string | null | undefined,
): Promise<void> {
  if (!globalPersonId?.trim()) return;
  const profile = await fetchOpsProfileForPatientFill(globalPersonId.trim());
  if (!profile) return;
  const patient = await prisma.patientRef.findUnique({ where: { id: patientId } });
  if (!patient) return;
  const patch = buildPatientDemographicsFillPatch(patient, profile);
  if (!patch) return;
  await persistFill(patientId, { ...patch, globalPersonId: globalPersonId.trim() });
}

/**
 * Page fill for demographic holes + MDM id.
 * Reception-filled fields are never overwritten (fill-not-clear).
 */
export async function fillPatientPageDemographicsFromMdm<T extends PatientDemographicsCacheRow>(
  rows: T[],
): Promise<T[]> {
  const needy = rows.filter(patientNeedsMdmDemographicsFill);
  if (needy.length === 0) return rows;

  const orgId = clinicOrganizationId();
  const byId = new Map(rows.map((r) => [r.id, { ...r }]));
  await Promise.all(
    needy.map(async (row) => {
      const gpid = row.globalPersonId!.trim();
      const profile = await fetchOpsProfileForPatientFill(gpid, orgId);
      if (!profile) return;
      const patch = buildPatientDemographicsFillPatch(row, profile);
      if (!patch) return;
      await persistFill(row.id, { ...patch, globalPersonId: gpid });
      const current = byId.get(row.id);
      if (!current) return;
      byId.set(row.id, {
        ...current,
        ...patch,
        globalPersonId: gpid,
      });
    }),
  );

  return rows.map((row) => byId.get(row.id) ?? row);
}
