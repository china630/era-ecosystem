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

const OPS_KEYS = ["patients", "episodes", "visits", "labOrders", "procedureOrders"] as const;
const CATALOG_KEYS = ["procedureTypes", "practitioners", "rooms", "programTemplates"] as const;
const OPS_PARENTS: Record<(typeof OPS_KEYS)[number], (typeof OPS_KEYS)[number][]> = {
  procedureOrders: ["episodes", "patients"],
  labOrders: ["episodes", "patients"],
  visits: ["episodes", "patients"],
  episodes: ["patients"],
  patients: [],
};

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
  const [opsOn, setOpsOn] = useState<Set<string>>(() => new Set(OPS_KEYS));
  const [catalogOn, setCatalogOn] = useState<Set<string>>(() => new Set(CATALOG_KEYS));

  function toggleOps(key: (typeof OPS_KEYS)[number]) {
    setOpsOn((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        for (const parent of OPS_PARENTS[key]) next.delete(parent);
      } else next.add(key);
      return next;
    });
  }

  function toggleCatalog(key: string) {
    setCatalogOn((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
        body: JSON.stringify({
          organizationId,
          confirmPhrase: phrase,
          ops: [...opsOn],
          catalog: [...catalogOn],
        }),
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
              <tr className={DATA_TABLE_TR_CLASS}>
                <td className={`${DATA_TABLE_TD_CLASS} font-semibold`} colSpan={2}>
                  {t("opsTitle")}
                </td>
              </tr>
              {OPS_KEYS.map((key) => (
                <tr key={key} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={opsOn.has(key)}
                        onChange={() => toggleOps(key)}
                      />
                      {t(key)}
                    </label>
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{loading ? "…" : (counts?.[key] ?? 0)}</td>
                </tr>
              ))}
              <tr className={DATA_TABLE_TR_CLASS}>
                <td className={`${DATA_TABLE_TD_CLASS} font-semibold`} colSpan={2}>
                  {t("catalogTitle")}
                </td>
              </tr>
              {CATALOG_KEYS.map((key) => (
                <tr key={key} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={catalogOn.has(key)}
                        onChange={() => toggleCatalog(key)}
                      />
                      {t(key)}
                    </label>
                  </td>
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
