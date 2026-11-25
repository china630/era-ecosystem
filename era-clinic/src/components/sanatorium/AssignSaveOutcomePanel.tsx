"use client";

import { TEXT_MUTED_CLASS, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import {
  buildAssignSaveOutcome,
  packageAssignMissAdviceKey,
  type AssignOutcomeMissRow,
  type AssignSaveOutcome,
} from "@/lib/package-assign-outcome";
import {
  packageAssignMissReasonText,
  type AssignToastLine,
  type AssignToastMiss,
} from "@/lib/package-assign-toasts";

function formatOutcomeMissReason(
  row: AssignOutcomeMissRow,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const reasonText = packageAssignMissReasonText(row.reason, (key) => t(key), {
    hitAttemptCap: row.hitAttemptCap === true,
  });
  if (row.staffName?.trim()) {
    return t("packageAssignMissNamed", {
      date: "",
      reason: reasonText,
      name: row.staffName.trim(),
    });
  }
  return reasonText;
}

export type AssignSaveOutcomeState = {
  requested: AssignToastLine[];
  misses: AssignToastMiss[];
};

export function AssignSaveOutcomePanel({
  outcome,
  onShowLoad,
  onFocusMiss,
  t,
}: {
  outcome: AssignSaveOutcomeState;
  onShowLoad: () => void;
  onFocusMiss?: (procedureCode: string, ymd?: string) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const summary: AssignSaveOutcome = buildAssignSaveOutcome(outcome.requested, outcome.misses);
  if (summary.requestedQty < 1 && summary.missQty < 1) return null;

  return (
    <div className="flex min-h-0 flex-col gap-1 border-t border-[#E8EEF4] pt-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-[#2C3E50]">
          {t("packageAssignOutcomeTitle", {
            placed: summary.placedQty,
            requested: summary.requestedQty,
          })}
        </p>
        <button type="button" className={`${SECONDARY_BUTTON_CLASS} !px-2 !py-0.5 text-[11px]`} onClick={onShowLoad}>
          {t("packageAssignShowLoad")}
        </button>
      </div>
      {summary.missQty > 0 ? (
        <p className={`text-[11px] ${TEXT_MUTED_CLASS}`}>{t("packageAssignOutcomeQuotaHint")}</p>
      ) : (
        <p className={`text-[11px] ${TEXT_MUTED_CLASS}`}>{t("packageAssignOutcomeAllPlaced")}</p>
      )}
      {summary.misses.length > 0 ? (
        <ul className="max-h-36 min-h-0 space-y-1.5 overflow-y-auto pr-0.5 text-[12px]">
          {summary.misses.map((row) => {
            const reason = formatOutcomeMissReason(row, t);
            const advice = t(packageAssignMissAdviceKey(row.reason, { hitAttemptCap: row.hitAttemptCap }));
            const who =
              row.count > 1
                ? `${row.count} × ${row.procedureName}`
                : row.procedureName;
            const when = row.ymd ? ` (${row.ymd.slice(5)})` : "";
            return (
              <li key={row.key} className="rounded border border-[#F0D0D0] bg-[#FFF8F8] px-1.5 py-1">
                {onFocusMiss && row.procedureCode ? (
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => onFocusMiss(row.procedureCode, row.ymd)}
                  >
                    <span className="font-medium text-[#8B2E2E]">
                      {who}
                      {when}
                    </span>
                    <span className="block text-[#5C3A3A]">{reason}</span>
                    <span className={`block ${TEXT_MUTED_CLASS}`}>{advice}</span>
                  </button>
                ) : (
                  <>
                    <span className="font-medium text-[#8B2E2E]">
                      {who}
                      {when}
                    </span>
                    <span className="block text-[#5C3A3A]">{reason}</span>
                    <span className={`block ${TEXT_MUTED_CLASS}`}>{advice}</span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
