/**
 * Closed-course archive filters for patient Plan + guest handoff prints.
 * When showNonExecuted is true (tenant default), CANCELLED/NO_SHOW appear
 * with status labels; package_assign_adjust cancellations stay hidden.
 */

export const PACKAGE_ASSIGN_ADJUST_REASON = "package_assign_adjust";

export const ARCHIVE_EXECUTED_PROCEDURE_STATUSES = ["CHECKED_IN", "COMPLETED"] as const;

export const ARCHIVE_LAB_LIVE_STATUSES = [
  "COLLECTED",
  "IN_PROGRESS",
  "RESULT_READY",
  "PUBLISHED",
  "COMPLETED",
] as const;

export const ARCHIVE_EPISODE_SUMMARY_LAB_STATUSES = [
  "RESULT_READY",
  "PUBLISHED",
  "COMPLETED",
] as const;

/** Prisma where for ProcedureOrder on a CLOSED episode. */
export function archiveProcedureWhere(showNonExecuted: boolean) {
  if (!showNonExecuted) {
    return { status: { in: [...ARCHIVE_EXECUTED_PROCEDURE_STATUSES] } };
  }
  return {
    OR: [
      { status: { in: ["CHECKED_IN", "COMPLETED", "NO_SHOW"] as const } },
      {
        status: "CANCELLED" as const,
        NOT: { cancelReason: PACKAGE_ASSIGN_ADJUST_REASON },
      },
    ],
  };
}

/** Prisma where for LabOrder on a CLOSED episode (Plan + studies print). */
export function archiveLabWhere(showNonExecuted: boolean) {
  if (!showNonExecuted) {
    return { status: { in: [...ARCHIVE_LAB_LIVE_STATUSES] } };
  }
  return {
    status: { in: [...ARCHIVE_LAB_LIVE_STATUSES, "CANCELLED"] },
  };
}

/** Episode summary labs: result-bearing rows; ON also lists CANCELLED without results. */
export function archiveEpisodeSummaryLabStatusWhere(showNonExecuted: boolean) {
  if (!showNonExecuted) {
    return { status: { in: [...ARCHIVE_EPISODE_SUMMARY_LAB_STATUSES] } };
  }
  return {
    status: { in: [...ARCHIVE_EPISODE_SUMMARY_LAB_STATUSES, "CANCELLED"] },
  };
}

/** Prisma where for Visit on a CLOSED episode. */
export function archiveVisitWhere(showNonExecuted: boolean) {
  if (!showNonExecuted) {
    return { status: "COMPLETED" as const };
  }
  return { status: { in: ["COMPLETED", "CANCELLED"] as const } };
}

/** Pure predicate for unit tests / client tones. */
export function includesArchiveProcedure(row: {
  status: string;
  cancelReason?: string | null;
}, showNonExecuted: boolean): boolean {
  if (row.status === "CHECKED_IN" || row.status === "COMPLETED") return true;
  if (!showNonExecuted) return false;
  if (row.status === "NO_SHOW") return true;
  if (row.status === "CANCELLED") {
    return row.cancelReason !== PACKAGE_ASSIGN_ADJUST_REASON;
  }
  return false;
}

export function includesArchiveLab(status: string, showNonExecuted: boolean): boolean {
  if ((ARCHIVE_LAB_LIVE_STATUSES as readonly string[]).includes(status)) return true;
  return showNonExecuted && status === "CANCELLED";
}

export function includesArchiveVisit(status: string, showNonExecuted: boolean): boolean {
  if (status === "COMPLETED") return true;
  return showNonExecuted && status === "CANCELLED";
}
