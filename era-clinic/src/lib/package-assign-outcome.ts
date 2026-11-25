/**
 * Save-outcome panel helpers for package / extras Saxla (CLI-57).
 * Quota still returns for unseated rows — this is an explanation layer only.
 */

export type AssignOutcomeMissInput = {
  procedureCode?: string;
  procedureName?: string;
  ymd?: string;
  reason?: string;
  staffName?: string;
  hitAttemptCap?: boolean;
};

export type AssignOutcomeRequested = {
  procedureCode: string;
  procedureName: string;
  qty: number;
};

export type AssignOutcomeMissRow = {
  key: string;
  procedureCode: string;
  procedureName: string;
  ymd?: string;
  reason?: string;
  staffName?: string;
  hitAttemptCap?: boolean;
  count: number;
};

export type AssignSaveOutcome = {
  requestedQty: number;
  placedQty: number;
  missQty: number;
  misses: AssignOutcomeMissRow[];
};

export function buildAssignSaveOutcome(
  requested: AssignOutcomeRequested[],
  misses: AssignOutcomeMissInput[] | undefined,
): AssignSaveOutcome {
  let requestedQty = 0;
  for (const row of requested) {
    if (row.qty > 0) requestedQty += row.qty;
  }
  const missList = misses ?? [];
  const groups = new Map<string, AssignOutcomeMissRow>();
  for (const miss of missList) {
    const procedureCode = miss.procedureCode || miss.procedureName || "";
    const procedureName = miss.procedureName || miss.procedureCode || "—";
    const key = [
      procedureCode,
      miss.ymd ?? "",
      miss.reason ?? "",
      miss.hitAttemptCap === true ? "1" : "0",
      miss.staffName?.trim() ?? "",
    ].join("\0");
    const prev = groups.get(key);
    if (prev) {
      prev.count += 1;
      continue;
    }
    groups.set(key, {
      key,
      procedureCode,
      procedureName,
      ymd: miss.ymd,
      reason: miss.reason,
      staffName: miss.staffName,
      hitAttemptCap: miss.hitAttemptCap === true,
      count: 1,
    });
  }
  const missRows = [...groups.values()];
  const missQty = missList.length;
  const placedQty = Math.max(0, requestedQty - missQty);
  return { requestedQty, placedQty, missQty, misses: missRows };
}

/** i18n key under patientCard.* for a short fix hint. */
export function packageAssignMissAdviceKey(
  reason: string | undefined,
  opts?: { hitAttemptCap?: boolean },
): string {
  if (opts?.hitAttemptCap) return "packageAssignAdviceBusy";
  switch (reason) {
    case "no_staff":
      return "packageAssignAdviceNoStaff";
    case "staff_busy":
      return "packageAssignAdviceStaffBusy";
    case "cabin_sex":
      return "packageAssignAdviceCabinSex";
    case "no_cabin":
    case "cabin_busy":
      return "packageAssignAdviceNoCabin";
    case "day_full":
      return "packageAssignAdviceDayFull";
    case "same_day":
      return "packageAssignAdviceSameDay";
    case "rule":
      return "packageAssignAdviceRule";
    case "no_slot":
      return "packageAssignAdviceNoSlot";
    case "anamnesis":
      return "packageAssignAdviceAnamnesis";
    case "no_mode":
      return "packageAssignAdviceNoBathMode";
    case "bath_rest":
      return "packageAssignAdviceBathRest";
    case "series_rhythm":
      return "packageAssignAdviceSeriesRhythm";
    case "week_full":
      return "packageAssignAdviceWeekFull";
    case "closed":
      return "packageAssignAdviceClosed";
    case "lunch":
      return "packageAssignAdviceLunch";
    case "past_checkout":
      return "packageAssignAdvicePastCheckout";
    case "checkout_noon":
      return "packageAssignAdviceCheckoutNoon";
    default:
      return "packageAssignAdviceNoDay";
  }
}
