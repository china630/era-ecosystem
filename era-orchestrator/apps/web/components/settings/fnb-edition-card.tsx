"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { WorkforceConfirmDialog } from "../workspace/workforce-confirm-dialog";
import { getOrchAccessToken, orchFetch } from "../../lib/orch-api";

type FnbEditionState = {
  hasFnb: boolean;
  edition: "kafe" | "fnb" | null;
  canUpgrade: boolean;
  synced?: boolean;
};

/** Owner-only: shows the F&B edition and upgrades ERA Kafe to full F&B. */
export function FnbEditionCard() {
  const t = useTranslations("settings.fnbEdition");
  const [state, setState] = useState<FnbEditionState | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = getOrchAccessToken();
    if (!token) return;
    let cancelled = false;
    void orchFetch("/v1/fnb/edition", { token })
      .then(async (res) => (res.ok ? ((await res.json()) as FnbEditionState) : null))
      .then((data) => {
        if (!cancelled && data) setState(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function upgrade() {
    const token = getOrchAccessToken();
    if (!token) return;
    setBusy(true);
    try {
      const res = await orchFetch("/v1/fnb/edition/upgrade", { token, method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showApiError(data, t("upgradeFailed"));
        return;
      }
      const next = data as FnbEditionState;
      setState(next);
      setConfirmOpen(false);
      showSuccess(next.synced === false ? t("upgradedPending") : t("upgraded"));
    } finally {
      setBusy(false);
    }
  }

  if (!state?.hasFnb) return null;

  return (
    <div className={`${CARD_CONTAINER_CLASS} mt-4 space-y-3 p-4`}>
      <h2 className="text-sm font-semibold text-[#34495E]">{t("title")}</h2>
      <p className="text-sm text-[#34495E]">
        {state.edition === "kafe" ? t("kafe") : t("fnb")}
      </p>
      <p className="text-xs text-[#7F8C8D]">
        {state.edition === "kafe" ? t("kafeHint") : t("fnbHint")}
      </p>
      {state.canUpgrade ? (
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          onClick={() => setConfirmOpen(true)}
        >
          {t("upgrade")}
        </button>
      ) : null}
      <WorkforceConfirmDialog
        open={confirmOpen}
        title={t("confirmTitle")}
        body={t("confirmBody")}
        confirmLabel={t("upgrade")}
        cancelLabel={t("cancel")}
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void upgrade()}
      />
    </div>
  );
}
