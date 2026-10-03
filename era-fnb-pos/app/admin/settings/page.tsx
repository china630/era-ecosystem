"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import FbPosNav from "@/components/FbPosNav";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  Field,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";

type PresetState = {
  edition: string;
  enabledPresets: string[];
  selectablePresets: string[];
};

const PRESET_LABEL_KEY: Record<string, string> = {
  cafe: "presetCafe",
  restaurant: "presetRestaurant",
  banquet: "presetBanquet",
};

export default function AdminSettingsPage() {
  const t = useTranslations("admin.settings");
  const tNav = useTranslations("nav");
  const [dayStart, setDayStart] = useState("05:00");
  const [dayOpen, setDayOpen] = useState(false);
  const [dayDraft, setDayDraft] = useState("05:00");
  const [presets, setPresets] = useState<PresetState | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetDraft, setPresetDraft] = useState<string[]>([]);

  useEffect(() => {
    void fetch("/api/settings/business-day")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d?.businessDayStart === "string") setDayStart(d.businessDayStart);
      })
      .catch(() => undefined);
    void fetch("/api/settings/presets")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.enabledPresets)) setPresets(d as PresetState);
      })
      .catch(() => undefined);
  }, []);

  async function saveDayStart() {
    const res = await fetch("/api/settings/business-day", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessDayStart: dayDraft }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("save"));
      return;
    }
    setDayStart(typeof data?.businessDayStart === "string" ? data.businessDayStart : dayDraft);
    setDayOpen(false);
    showSuccess(t("saved"));
  }

  async function savePresets() {
    const res = await fetch("/api/settings/presets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabledPresets: presetDraft }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("save"));
      return;
    }
    setPresets(data as PresetState);
    setPresetOpen(false);
    showSuccess(t("saved"));
    window.location.reload();
  }

  const presetLabel = (code: string) =>
    PRESET_LABEL_KEY[code] ? t(PRESET_LABEL_KEY[code]) : code;
  const canEditPresets = (presets?.selectablePresets.length ?? 0) > 1;

  return (
    <>
      <FbPosNav />
      <PageHeader
        title={t("title")}
        actions={
          <Link href="/admin/menu" className={SECONDARY_BUTTON_CLASS}>
            {tNav("menu")}
          </Link>
        }
      />
      <table className={`${CARD_CONTAINER_CLASS} mt-4 w-full text-left text-sm`}>
        <thead>
          <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
            <th className="p-3">{t("field")}</th>
            <th className="p-3">{t("value")}</th>
            <th className="p-3 text-right">{t("actions")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-3 font-medium">{t("businessDayStart")}</td>
            <td className="p-3">
              {dayStart}
            </td>
            <td className="p-3 text-right">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => {
                  setDayDraft(dayStart);
                  setDayOpen(true);
                }}
              >
                {t("edit")}
              </button>
            </td>
          </tr>
          {presets ? (
            <tr className="border-t border-[#ECF0F1]">
              <td className="p-3 font-medium">{t("edition")}</td>
              <td className="p-3">
                {presets.edition === "kafe" ? t("editionKafe") : t("editionFnb")}
              </td>
              <td className="p-3" />
            </tr>
          ) : null}
          {presets ? (
            <tr className="border-t border-[#ECF0F1]">
              <td className="p-3 font-medium" title={t("presetsHint")}>
                {t("presets")}
              </td>
              <td className="p-3">{presets.enabledPresets.map(presetLabel).join(", ")}</td>
              <td className="p-3 text-right">
                {canEditPresets ? (
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    onClick={() => {
                      setPresetDraft(
                        presets.enabledPresets.filter((p) => presets.selectablePresets.includes(p)),
                      );
                      setPresetOpen(true);
                    }}
                  >
                    {t("edit")}
                  </button>
                ) : null}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <ModalShell open={dayOpen} title={t("businessDayStart")} onClose={() => setDayOpen(false)}>
        <Field
          label={t("businessDayStart")}
          preset="shortText"
          type="time"
          value={dayDraft}
          onChange={(e) => setDayDraft(e.target.value)}
        />
        <ModalFooter onCancel={() => setDayOpen(false)} onSubmit={() => void saveDayStart()} submitLabel={t("save")} />
      </ModalShell>
      <ModalShell open={presetOpen} title={t("presets")} onClose={() => setPresetOpen(false)}>
        <CatalogField
          kind="MULTI"
          label={t("presets")}
          hint={t("presetsHint")}
          value={presetDraft}
          onChange={(next) => setPresetDraft(Array.isArray(next) ? next : next ? [next] : [])}
          options={(presets?.selectablePresets ?? []).map((code) => ({
            value: code,
            label: presetLabel(code),
          }))}
        />
        <ModalFooter
          onCancel={() => setPresetOpen(false)}
          onSubmit={() => void savePresets()}
          submitLabel={t("save")}
        />
      </ModalShell>
    </>
  );
}
