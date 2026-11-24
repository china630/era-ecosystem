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
  hitAttemptCap?: boolean;
  /** OPEN drops — never checkout-morning hold (cabin FIXED only). */
  schedulingMode?: "OPEN" | "FIXED" | string;
};

/** Max lines shown in each outcome toast before “and N more”. */
export const PACKAGE_ASSIGN_TOAST_LINE_CAP = 8;

/** Stay-horizon hold for checkout-morning ask — never budget/attempt-cap stops or OPEN drops. */
export function isPackageAssignNoonHold(miss: AssignToastMiss): boolean {
  if (miss.hitAttemptCap === true) return false;
  if (miss.schedulingMode === "OPEN") return false;
  return miss.reason === "no_slot" || miss.reason === "no_day";
}

export function packageAssignMissReasonText(
  reason: string | undefined,
  t: (key: string) => string,
  opts?: { hitAttemptCap?: boolean },
): string {
  if (opts?.hitAttemptCap) return t("packageAssignMissBusy");
  if (reason === "no_staff") return t("packageAssignMissNoStaff");
  if (reason === "staff_busy") return t("packageAssignMissStaffBusy");
  if (reason === "cabin_sex") return t("packageAssignMissCabinSex");
  if (reason === "no_cabin" || reason === "cabin_busy") return t("packageAssignMissNoCabin");
  if (reason === "day_full") return t("packageAssignMissDayFull");
  if (reason === "same_day") return t("packageAssignMissSameDay");
  if (reason === "rule") return t("packageAssignMissRule");
  if (reason === "no_slot") return t("packageAssignMissNoSlot");
  if (reason === "anamnesis") return t("packageAssignMissAnamnesis");
  if (reason === "no_mode") return t("packageAssignMissNoBathMode");
  if (reason === "bath_rest") return t("packageAssignMissBathRest");
  if (reason === "series_rhythm") return t("packageAssignMissSeriesRhythm");
  if (reason === "week_full") return t("packageAssignMissWeekFull");
  if (reason === "closed") return t("packageAssignMissClosed");
  if (reason === "lunch") return t("packageAssignMissLunch");
  if (reason === "past_checkout") return t("packageAssignMissPastCheckout");
  if (reason === "checkout_noon") return t("packageAssignMissCheckoutNoon");
  return t("packageAssignMissNoDay");
}

export function formatPackageAssignMissLines(
  misses: AssignToastMiss[] | undefined,
  t: (key: string, values?: { date: string; reason: string; name?: string }) => string,
): string {
  if (!misses?.length) return "";
  return misses
    .map((miss) => {
      const reasonText = packageAssignMissReasonText(miss.reason, (key) => t(key), {
        hitAttemptCap: miss.hitAttemptCap === true,
      });
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

type ToastT = (
  key: string,
  values?: { count: number; name: string; date?: string; reason?: string },
) => string;

function toastBody(lines: string[], t: ToastT): string {
  if (lines.length <= PACKAGE_ASSIGN_TOAST_LINE_CAP) return lines.join("\n");
  const head = lines.slice(0, PACKAGE_ASSIGN_TOAST_LINE_CAP);
  const more = lines.length - PACKAGE_ASSIGN_TOAST_LINE_CAP;
  return [...head, t("packageAssignToastMore", { count: more, name: "" })].join("\n");
}

/** Placed qty per procedure code = requested − miss count for that code. */
export function buildPackageAssignPlacedLines(
  requested: AssignToastLine[],
  misses: AssignToastMiss[] | undefined,
  t: ToastT,
): string[] {
  const asked = new Map<string, { name: string; qty: number }>();
  for (const row of requested) {
    const code = row.procedureCode || row.procedureName;
    if (!code || row.qty < 1) continue;
    const prev = asked.get(code);
    const name = row.procedureName || row.procedureCode || code;
    if (prev) prev.qty += row.qty;
    else asked.set(code, { name, qty: row.qty });
  }
  const failed = new Map<string, number>();
  for (const miss of misses ?? []) {
    const code = miss.procedureCode || miss.procedureName || "";
    if (!code) continue;
    failed.set(code, (failed.get(code) ?? 0) + 1);
  }
  const lines: string[] = [];
  for (const [code, row] of asked) {
    const placed = Math.max(0, row.qty - (failed.get(code) ?? 0));
    if (placed < 1) continue;
    lines.push(t("packageAssignPlaced", { count: placed, name: row.name }));
  }
  return lines;
}

/** Misses collapsed by SKU + reason (+ staff / cap). */
export function buildPackageAssignMissToastLines(
  misses: AssignToastMiss[] | undefined,
  t: ToastT,
): string[] {
  if (!misses?.length) return [];
  type Acc = { name: string; count: number; reason: string };
  const groups = new Map<string, Acc>();
  for (const miss of misses) {
    const name = miss.procedureName || miss.procedureCode || "—";
    const code = miss.procedureCode || name;
    const reasonText = packageAssignMissReasonText(miss.reason, (key) => t(key, { count: 0, name: "" }), {
      hitAttemptCap: miss.hitAttemptCap === true,
    });
    const reason = miss.staffName?.trim()
      ? t("packageAssignMissNamed", {
          count: 0,
          name: miss.staffName.trim(),
          date: "",
          reason: reasonText,
        })
      : reasonText;
    const key = `${code}\0${miss.reason ?? ""}\0${miss.hitAttemptCap === true ? "1" : "0"}\0${miss.staffName?.trim() ?? ""}`;
    const prev = groups.get(key);
    if (prev) prev.count += 1;
    else groups.set(key, { name, count: 1, reason });
  }
  return [...groups.values()].map((row) =>
    t("packageAssignNotPlacedLine", { count: row.count, name: row.name, reason: row.reason }),
  );
}

/**
 * At most two toasts for a Saxla/extras save:
 * green = list of placed SKU lines; red = list of missed SKU lines with reason.
 */
export function toastPackageAssignOutcome(
  requested: AssignToastLine[],
  misses: AssignToastMiss[] | undefined,
  t: ToastT,
): void {
  const placedLines = buildPackageAssignPlacedLines(requested, misses, t);
  const missLines = buildPackageAssignMissToastLines(misses, t);
  if (placedLines.length < 1 && missLines.length < 1) return;
  if (placedLines.length > 0) {
    showSuccess(toastBody(placedLines, t));
  }
  if (missLines.length > 0) {
    showApiError({ error: toastBody(missLines, t) });
  }
}
