"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS, TEXT_MUTED_CLASS } from "@era/satellite-kit/ui";

type CarePlanStage = {
  code: string;
  title: string;
  status: string;
};

type CarePlan = {
  id: string;
  status: string;
  title: string | null;
  stages: CarePlanStage[];
};

export function VisitCarePlanPanel({ visitId }: { visitId: string }) {
  const t = useTranslations("carePlan");
  const [plan, setPlan] = useState<CarePlan | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/visits/${visitId}/care-plan`);
    const data = await res.json();
    setPlan((data.carePlan ?? null) as CarePlan | null);
  }, [visitId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createDraft() {
    setBusy(true);
    try {
      await fetch(`/api/visits/${visitId}/care-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stages: [
            { code: "STAGE-1", title: t("stageConsult"), status: "PENDING" },
            { code: "STAGE-2", title: t("stageDiagnostics"), status: "PENDING" },
            { code: "STAGE-3", title: t("stageFollowUp"), status: "PENDING" },
          ],
        }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${CARD_CONTAINER_CLASS} space-y-2 p-3`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{t("title")}</h3>
        {plan && (
          <span className={`text-xs ${TEXT_MUTED_CLASS}`}>
            {t("status")}: {plan.status}
          </span>
        )}
      </div>
      {!plan ? (
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void createDraft()}>
          {busy ? t("creating") : t("createDraft")}
        </button>
      ) : (
        <ul className="space-y-1 text-sm">
          {plan.stages.map((s) => (
            <li key={s.code} className="flex justify-between border-b border-slate-100 py-1">
              <span>{s.title}</span>
              <span className={TEXT_MUTED_CLASS}>{s.status}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-500">{t("hint")}</p>
    </div>
  );
}