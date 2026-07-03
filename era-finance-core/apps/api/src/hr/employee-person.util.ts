import type { OrchestratorMdmClientService } from "../orchestrator/orchestrator-mdm-client.service";

export type EmployeePersonDisplay = {
  displayName: string | null;
  finMasked: string | null;
  accessDenied: boolean;
  firstName: string;
  lastName: string;
  /** Masked identifier for list columns (never plaintext FIN). */
  finCode: string | null;
};

const FALLBACK_PERSON: EmployeePersonDisplay = {
  displayName: null,
  finMasked: null,
  accessDenied: true,
  firstName: "—",
  lastName: "—",
  finCode: null,
};

/** AZ convention: first token = surname, remainder = given name(s). */
export function splitAzPersonName(displayName: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const parts = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "—", lastName: "—" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: parts[0]! };
  return { lastName: parts[0]!, firstName: parts.slice(1).join(" ") };
}

export function personDisplayFromOpsProfile(
  profile:
    | {
        displayName: string | null;
        primaryIdentifierMasked: string | null;
        accessDenied: boolean;
      }
    | undefined,
): EmployeePersonDisplay {
  if (!profile) return { ...FALLBACK_PERSON };
  const names = splitAzPersonName(profile.displayName);
  return {
    displayName: profile.displayName,
    finMasked: profile.primaryIdentifierMasked,
    accessDenied: profile.accessDenied,
    firstName: names.firstName,
    lastName: names.lastName,
    finCode: profile.primaryIdentifierMasked,
  };
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
