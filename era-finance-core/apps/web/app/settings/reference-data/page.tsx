"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/api-client";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "../../../lib/design-system";
import { FORM_INPUT_CLASS } from "../../../lib/form-styles";
import { PageHeader } from "../../../components/layout/page-header";
import { useRequireAuth } from "../../../lib/use-require-auth";

type Catalog = "fx" | "banks" | "calendar" | "hs";

export default function ReferenceDataSettingsPage() {
  const { t } = useTranslation();
  const ready = useRequireAuth();
  const [mode, setMode] = useState<"hub" | "excel" | null>(null);
  const [busy, setBusy] = useState<Catalog | null>(null);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const res = await apiFetch("/api/reference-manual/mode");
      if (!res.ok) return;
      const body = (await res.json()) as { referenceSource?: "hub" | "excel" };
      setMode(body.referenceSource === "excel" ? "excel" : "hub");
    })();
  }, [ready]);

  async function downloadTemplate() {
    const res = await apiFetch("/api/reference-manual/fx-template.xlsx");
    if (!res.ok) {
      toast.error(t("nav.referenceFailed"));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fx-rates.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function upload(catalog: Catalog, file: File) {
    setBusy(catalog);
    const body = new FormData();
    body.append("file", file);
    const res = await apiFetch(`/api/reference-manual/${catalog}`, { method: "POST", body });
    setBusy(null);
    if (!res.ok) {
      toast.error(t("nav.referenceFailed"));
      return;
    }
    toast.success(t("nav.referenceSaved"));
  }

  if (!ready) return null;

  return (
    <div className="space-y-4">
      <PageHeader title={t("nav.referenceData")} />
      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4 text-sm text-[#34495E]`}>
        <p>{t("nav.referenceHint")}</p>
        {mode ? (
          <p>
            {t("nav.referenceMode")}: {mode === "excel" ? "Excel" : "Data hub"}
          </p>
        ) : null}
        {mode === "excel" ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              className="text-left text-[#2980B9]"
              onClick={() => void downloadTemplate()}
            >
              fx-rates.xlsx
            </button>
            {(
              [
                ["fx", "nav.referenceUploadFx"],
                ["banks", "nav.referenceUploadBanks"],
                ["calendar", "nav.referenceUploadCalendar"],
                ["hs", "nav.referenceUploadHs"],
              ] as const
            ).map(([catalog, label]) => (
              <label key={catalog} className="flex flex-wrap items-center gap-2">
                <span>{t(label)}</span>
                <input
                  type="file"
                  className={FORM_INPUT_CLASS}
                  accept=".xlsx"
                  disabled={busy !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(catalog, file);
                    event.target.value = "";
                  }}
                />
              </label>
            ))}
            {busy ? <span className={PRIMARY_BUTTON_CLASS}>{busy}</span> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
