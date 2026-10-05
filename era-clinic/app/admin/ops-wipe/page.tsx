"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  Field,
  FORM_STACK_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { useClinicAuth } from "@/hooks/useClinicAuth";

type Counts = Record<string, number>;

const COUNT_KEYS = [
  "procedureOrders",
  "procedureAllocations",
  "procedureOrderSites",
  "procedureResourceBookings",
  "procedureChargeLogs",
] as const;

export default function ClinicOpsWipePage() {
  const t = useTranslations("opsWipe");
  const tc = useTranslations("common");
  const { auth, loading: authLoading } = useClinicAuth();
  const [organizationId, setOrganizationId] = useState("");
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ops-wipe");
      const data = (await res.json()) as {
        error?: string;
        organizationId?: string;
        counts?: Counts;
      };
      if (!res.ok) {
        showApiError(data, tc("failed"));
        return;
      }
      setOrganizationId(data.organizationId ?? "");
      setCounts(data.counts ?? null);
    } finally {
      setLoading(false);
    }
  }, [tc]);

  useEffect(() => {
    if (auth?.isPlatformSuperAdmin) void load();
  }, [auth?.isPlatformSuperAdmin, load]);

  if (authLoading) return null;
  if (!auth?.isPlatformSuperAdmin) {
    return <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{t("accessDenied")}</p>;
  }

  async function wipe() {
    if (phrase !== "WIPE") {
      showApiError({ error: t("phraseMismatch") });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ops-wipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, confirmPhrase: phrase }),
      });
      const data = (await res.json()) as { error?: string; counts?: Counts };
      if (!res.ok) {
        showApiError(data, tc("failed"));
        return;
      }
      setCounts(data.counts ?? null);
      setConfirmOpen(false);
      setPhrase("");
      showSuccess(t("done"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={loading || !counts}
            onClick={() => {
              setPhrase("");
              setConfirmOpen(true);
            }}
          >
            {t("wipe")}
          </button>
        }
      />
      <p className={`mb-3 text-[13px] ${TEXT_MUTED_CLASS}`}>{t("keepsCatalogs")}</p>
      <div className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("what")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("count")}</th>
              </tr>
            </thead>
            <tbody>
              {COUNT_KEYS.map((key) => (
                <tr key={key} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{t(key)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{loading ? "…" : (counts?.[key] ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ModalShell
        open={confirmOpen}
        title={t("confirmTitle")}
        onClose={() => setConfirmOpen(false)}
        closeLabel={tc("close")}
      >
        <div className={FORM_STACK_CLASS}>
          <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t("confirmHint")}</p>
          <Field
            label={t("phraseLabel")}
            preset="code"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
          />
        </div>
        <ModalFooter
          onCancel={() => setConfirmOpen(false)}
          onSubmit={() => void wipe()}
          submitLabel={busy ? t("wiping") : t("wipe")}
          cancelLabel={tc("cancel")}
          submitDisabled={busy}
        />
      </ModalShell>
    </>
  );
}
