"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Field,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { CARD_CLASS } from "@/lib/design-system";

type IntegrationDraft = {
  financeWebUrl: string;
  hotelPmsUrl: string;
  orchestratorBaseUrl: string;
};

export default function FnbIntegrationSettingsPanel() {
  const t = useTranslations("admin.settings");
  const [draft, setDraft] = useState<IntegrationDraft>({
    financeWebUrl: "",
    hotelPmsUrl: "",
    orchestratorBaseUrl: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/settings/integrations")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const s = d?.settings;
        if (!s) return;
        setDraft({
          financeWebUrl: typeof s.financeWebUrl === "string" ? s.financeWebUrl : "",
          hotelPmsUrl: typeof s.hotelPmsUrl === "string" ? s.hotelPmsUrl : "",
          orchestratorBaseUrl:
            typeof s.orchestratorBaseUrl === "string" ? s.orchestratorBaseUrl : "",
        });
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showApiError(data, t("save"));
        return;
      }
      const s = data?.settings;
      if (s) {
        setDraft({
          financeWebUrl: s.financeWebUrl ?? "",
          hotelPmsUrl: s.hotelPmsUrl ?? "",
          orchestratorBaseUrl: s.orchestratorBaseUrl ?? "",
        });
      }
      showSuccess(t("saved"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${CARD_CLASS} mt-6 space-y-4 p-4`}>
      <div>
        <h2 className="m-0 text-sm font-semibold text-[#2C3E50]">{t("integrationsTitle")}</h2>
        <p className="m-0 mt-1 text-xs text-[#7F8C8D]">{t("integrationsHint")}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Field
          label={t("financeWebUrl")}
          preset="longText"
          value={draft.financeWebUrl}
          onChange={(e) => setDraft((d) => ({ ...d, financeWebUrl: e.target.value }))}
          placeholder="https://finance-core.era-365.online"
          hint={t("financeWebUrlHint")}
        />
        <Field
          label={t("hotelPmsUrl")}
          preset="longText"
          value={draft.hotelPmsUrl}
          onChange={(e) => setDraft((d) => ({ ...d, hotelPmsUrl: e.target.value }))}
          placeholder="https://hotel-pms.era-365.online"
          hint={t("hotelPmsUrlHint")}
        />
        <Field
          label={t("orchestratorBaseUrl")}
          preset="longText"
          value={draft.orchestratorBaseUrl}
          onChange={(e) =>
            setDraft((d) => ({ ...d, orchestratorBaseUrl: e.target.value }))
          }
          placeholder="https://api.era-365.online"
          hint={t("orchestratorBaseUrlHint")}
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "…" : t("save")}
        </button>
      </div>
    </div>
  );
}
