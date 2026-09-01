import {
  composePersonFullName,
  splitFullNameToParts,
} from "@era/satellite-kit";
import type { OrchestratorMdmClientService } from "../orchestrator/orchestrator-mdm-client.service";

export type MdmOpsProfileSlice = {
  displayName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  primaryIdentifierMasked?: string | null;
  accessDenied?: boolean;
};

export type EmployeePersonDisplay = {
  displayName: string | null;
  finMasked: string | null;
  accessDenied: boolean;
  firstName: string;
  middleName: string;
  lastName: string;
  /** Masked identifier for list columns (never plaintext FIN). */
  finCode: string | null;
};

const FALLBACK_PERSON: EmployeePersonDisplay = {
  displayName: null,
  finMasked: null,
  accessDenied: true,
  firstName: "—",
  middleName: "",
  lastName: "—",
  finCode: null,
};

/** AZ payroll/timesheet list: surname first, then given + patronymic. */
export function formatAzEmployeeListName(
  person: Pick<EmployeePersonDisplay, "lastName" | "firstName" | "middleName">,
): string {
  return [person.lastName, person.firstName, person.middleName]
    .map((p) => p?.trim())
    .filter((p) => p && p !== "—")
    .join(" ")
    .trim();
}

export function personDisplayFromOpsProfile(
  profile: MdmOpsProfileSlice | undefined,
): EmployeePersonDisplay {
  if (!profile) return { ...FALLBACK_PERSON };

  const finMasked = profile.primaryIdentifierMasked ?? null;
  const accessDenied = profile.accessDenied ?? false;
  const first = profile.firstName?.trim();
  const middle = profile.middleName?.trim() ?? "";
  const last = profile.lastName?.trim();

  if (first || last) {
    const displayName =
      composePersonFullName(first, middle, last) ||
      profile.displayName?.trim() ||
      null;
    return {
      displayName,
      finMasked,
      accessDenied,
      firstName: first || "—",
      middleName: middle,
      lastName: last || "—",
      finCode: finMasked,
    };
  }

  const parts = splitFullNameToParts(profile.displayName);
  const displayName =
    profile.displayName?.trim() ||
    composePersonFullName(parts.firstName, parts.middleName, parts.lastName) ||
    null;
  return {
    displayName,
    finMasked,
    accessDenied,
    firstName: parts.firstName?.trim() || "—",
    middleName: parts.middleName?.trim() ?? "",
    lastName: parts.lastName?.trim() || "—",
    finCode: finMasked,
  };
}

export async function batchComplianceFinMap(
  mdm: OrchestratorMdmClientService,
  organizationId: string,
  personIds: string[],
): Promise<Map<string, { fin: string | null; note: string | null }>> {
  const unique = [...new Set(personIds.filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (globalPersonId) => {
      const ci = await mdm.complianceIdentity(globalPersonId, organizationId);
      if (!ci) {
        return { globalPersonId, fin: null, note: "MDM unavailable — FIN omitted" };
      }
      if (ci.accessDenied) {
        return { globalPersonId, fin: null, note: "FIN access denied — omitted" };
      }
      if (!ci.fin?.trim()) {
        return { globalPersonId, fin: null, note: "FIN not on file — omitted" };
      }
      return { globalPersonId, fin: ci.fin.trim(), note: null };
    }),
  );
  return new Map(entries.map((e) => [e.globalPersonId, { fin: e.fin, note: e.note }]));
}

export async function batchEmployeePersonMap(
  mdm: OrchestratorMdmClientService,
  organizationId: string,
  personIds: string[],
): Promise<Map<string, EmployeePersonDisplay>> {
  const unique = [...new Set(personIds.filter(Boolean))];
  const batch = await mdm.batchOpsProfile(unique, organizationId);
  const map = new Map<string, EmployeePersonDisplay>();
  for (const id of unique) {
    map.set(id, personDisplayFromOpsProfile(batch[id]));
  }
  return map;
}

export function attachEmployeePerson<T extends { globalPersonId: string }>(
  row: T,
  personMap: Map<string, EmployeePersonDisplay>,
): T & EmployeePersonDisplay & { person: EmployeePersonDisplay } {
  const person = personMap.get(row.globalPersonId) ?? { ...FALLBACK_PERSON };
  return {
    ...row,
    person,
    displayName: person.displayName,
    finMasked: person.finMasked,
    accessDenied: person.accessDenied,
    firstName: person.firstName,
    middleName: person.middleName,
    lastName: person.lastName,
    finCode: person.finCode,
  };
}

export async function enrichEmployeesWithMdm<T extends { globalPersonId: string }>(
  mdm: OrchestratorMdmClientService,
  organizationId: string,
  rows: T[],
): Promise<Array<T & EmployeePersonDisplay & { person: EmployeePersonDisplay }>> {
  const map = await batchEmployeePersonMap(
    mdm,
    organizationId,
    rows.map((r) => r.globalPersonId),
  );
  return rows.map((r) => attachEmployeePerson(r, map));
}
