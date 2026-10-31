import { showApiError, showSuccess } from "@era/satellite-kit/ui";

export type AssignToastLine = {
  procedureCode: string;
  procedureName: string;
  qty: number;
};

export type AssignToastMiss = {
  procedureCode?: string;
  procedureName?: string;
  ymd?: string;
  reason?: string;
  staffName?: string;
};

export function packageAssignMissReasonText(
  reason: string | undefined,
  t: (key: string) => string,
): string {
  if (reason === "no_staff") return t("packageAssignMissNoStaff");
  if (reason === "staff_busy") return t("packageAssignMissStaffBusy");
  if (reason === "cabin_sex") return t("packageAssignMissCabinSex");
  if (reason === "no_cabin" || reason === "cabin_busy") return t("packageAssignMissNoCabin");
  if (reason === "day_full") return t("packageAssignMissDayFull");
  if (reason === "rule") return t("packageAssignMissRule");
  if (reason === "no_slot") return t("packageAssignMissNoSlot");
  if (reason === "no_mode") return t("packageAssignMissNoBathMode");
  return t("packageAssignMissNoDay");
}

export function formatPackageAssignMissLines(
  misses: AssignToastMiss[] | undefined,
  t: (key: string, values?: { date: string; reason: string; name?: string }) => string,
): string {
  if (!misses?.length) return "";
  return misses
    .map((miss) => {
      const reasonText = packageAssignMissReasonText(miss.reason, (key) => t(key));
      const reason = miss.staffName?.trim()
        ? t("packageAssignMissNamed", { date: "", reason: reasonText, name: miss.staffName.trim() })
        : reasonText;
      const who = miss.procedureName || miss.procedureCode;
      if (who) return `${who}${miss.ymd ? ` (${miss.ymd})` : ""}: ${reason}`;
      return t("packageAssignMiss", { date: miss.ymd || "—", reason });
    })
    .filter((line, index, all) => all.indexOf(line) === index)
    .join("; ");
}

export function toastPackageAssignOutcome(
  requested: AssignToastLine[],
  misses: AssignToastMiss[] | undefined,
  t: (key: string, values?: { count: number; name: string; date?: string; reason?: string }) => string,
): void {
  const missQty = new Map<string, { name: string; qty: number }>();
  for (const miss of misses ?? []) {
    const code = miss.procedureCode || miss.procedureName || "";
    if (!code) continue;
    const name = miss.procedureName || miss.procedureCode || code;
    const row = missQty.get(code) ?? { name, qty: 0 };
    row.qty += 1;
    missQty.set(code, row);
  }

  const seen = new Set<string>();
  for (const line of requested) {
    if (line.qty < 1 || seen.has(line.procedureCode)) continue;
    seen.add(line.procedureCode);
    const asked = requested
      .filter((row) => row.procedureCode === line.procedureCode)
      .reduce((sum, row) => row.qty + sum, 0);
    const failed = missQty.get(line.procedureCode)?.qty ?? 0;
    const placed = Math.max(0, asked - failed);
    const name = line.procedureName || line.procedureCode;
    if (placed > 0) {
      showSuccess(t("packageAssignPlaced", { count: placed, name }));
    }
    if (failed > 0) {
      showApiError({
        error: t("packageAssignNotPlaced", { count: failed, name }),
      });
    }
  }

  for (const [code, row] of missQty) {
    if (seen.has(code)) continue;
    showApiError({
      error: t("packageAssignNotPlaced", { count: row.qty, name: row.name }),
    });
  }

  const detail = formatPackageAssignMissLines(misses, (key, values) =>
    values ? t(key, { count: 0, name: values.name ?? "", date: values.date, reason: values.reason }) : t(key),
  );
  if (detail) showApiError({ error: detail });
}
