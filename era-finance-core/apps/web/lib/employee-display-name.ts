/** AZ payroll/timesheet list: surname, given, patronymic (display only — SoR is MDM). */
export function formatAzEmployeeListName(e: {
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  displayName?: string | null;
}): string {
  const parts = [e.lastName, e.firstName, e.middleName]
    .map((p) => p?.trim())
    .filter((p) => p && p !== "—");
  const joined = parts.join(" ").trim();
  return joined || e.displayName?.trim() || "—";
}
