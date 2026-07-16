"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ALL_CLINIC_PRESETS,
  CLINIC_PRESET,
  type ClinicPresetCode,
} from "@/domain/presets/clinic-presets";
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

const PRESET_LABELS: Record<ClinicPresetCode, string> = {
  [CLINIC_PRESET.OUTPATIENT]: "Outpatient",
  [CLINIC_PRESET.INPATIENT_DAY]: "Inpatient day",
  [CLINIC_PRESET.SANATORIUM_CLINICAL]: "Sanatorium clinical",
  [CLINIC_PRESET.WELLNESS]: "Wellness",
};

type CardLimits = {
  patientCardResultsPreview: number;
  patientCardPlanPreview: number;
  patientCardHistoryPageSize: number;
  patientCardPlanPageSize: number;
};

const CARD_DEFAULTS: CardLimits = {
  patientCardResultsPreview: 5,
  patientCardPlanPreview: 15,
  patientCardHistoryPageSize: 25,
  patientCardPlanPageSize: 25,
};

export default function ClinicAdminSettingsPage() {
  const t = useTranslations("adminSettings");
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");
  const [clinicName, setClinicName] = useState("");
  const [enabledPresets, setEnabledPresets] = useState<ClinicPresetCode[]>([
    CLINIC_PRESET.OUTPATIENT,
  ]);
  const [cardLimits, setCardLimits] = useState<CardLimits>(CARD_DEFAULTS);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftPresets, setDraftPresets] = useState<ClinicPresetCode[]>([
    CLINIC_PRESET.OUTPATIENT,
  ]);
  const [draftCard, setDraftCard] = useState<CardLimits>(CARD_DEFAULTS);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        const row = d.data ?? d;
        const name = row.clinicName ?? "Demo clinic";
        setClinicName(name);
        setDraft(name);
        const presets = (row.enabledPresets ?? [CLINIC_PRESET.OUTPATIENT]) as ClinicPresetCode[];
        setEnabledPresets(presets);
        setDraftPresets(presets);
        const limits: CardLimits = {
          patientCardResultsPreview:
            row.patientCardResultsPreview ?? CARD_DEFAULTS.patientCardResultsPreview,
          patientCardPlanPreview:
            row.patientCardPlanPreview ?? CARD_DEFAULTS.patientCardPlanPreview,
          patientCardHistoryPageSize:
            row.patientCardHistoryPageSize ?? CARD_DEFAULTS.patientCardHistoryPageSize,
          patientCardPlanPageSize:
            row.patientCardPlanPageSize ?? CARD_DEFAULTS.patientCardPlanPageSize,
        };
        setCardLimits(limits);
        setDraftCard(limits);
      });
  }, []);

  function togglePreset(code: ClinicPresetCode) {
    setDraftPresets((prev) => {
      if (prev.includes(code)) {
        const next = prev.filter((p) => p !== code);
        return next.length > 0 ? next : [CLINIC_PRESET.OUTPATIENT];
      }
      return [...prev, code];
    });
  }

  async function save() {
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicName: draft.trim() || clinicName,
        enabledPresets: draftPresets,
        ...draftCard,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      const row = d.data ?? d;
      setClinicName(row.clinicName ?? draft);
      setEnabledPresets(row.enabledPresets ?? draftPresets);
      setCardLimits({
        patientCardResultsPreview:
          row.patientCardResultsPreview ?? draftCard.patientCardResultsPreview,
        patientCardPlanPreview: row.patientCardPlanPreview ?? draftCard.patientCardPlanPreview,
        patientCardHistoryPageSize:
          row.patientCardHistoryPageSize ?? draftCard.patientCardHistoryPageSize,
        patientCardPlanPageSize: row.patientCardPlanPageSize ?? draftCard.patientCardPlanPageSize,
      });
      setOpen(false);
      setMsg(tc("saved"));
      window.location.reload();
    } else {
      setMsg(tc("saveFailed"));
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/" className={SECONDARY_BUTTON_CLASS}>
            ← {tNav("home")}
          </Link>
        }
      />
      {msg ? <p className="mb-3 text-[13px]">{msg}</p> : null}
      <table className={`${CARD_CONTAINER_CLASS} mt-4 w-full text-left text-sm`}>
        <thead>
          <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
            <th className="p-3">{tc("field")}</th>
            <th className="p-3">{tc("value")}</th>
            <th className="p-3 text-right">{tc("actions")}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="p-3 font-medium">{t("clinicName")}</td>
            <td className="p-3">{clinicName}</td>
            <td className="p-3 text-right" rowSpan={6}>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => {
                  setDraft(clinicName);
                  setDraftPresets(enabledPresets);
                  setDraftCard(cardLimits);
                  setOpen(true);
                }}
              >
                {tc("edit")}
              </button>
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-3 font-medium">{t("enabledPresets")}</td>
            <td className="p-3">
              {enabledPresets.map((p) => PRESET_LABELS[p] ?? p).join(", ")}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-3 font-medium">{t("cardResultsPreview")}</td>
            <td className="p-3">{cardLimits.patientCardResultsPreview}</td>
          </tr>
          <tr className="border-b">
            <td className="p-3 font-medium">{t("cardPlanPreview")}</td>
            <td className="p-3">{cardLimits.patientCardPlanPreview}</td>
          </tr>
          <tr className="border-b">
            <td className="p-3 font-medium">{t("cardHistoryPageSize")}</td>
            <td className="p-3">{cardLimits.patientCardHistoryPageSize}</td>
          </tr>
          <tr>
            <td className="p-3 font-medium">{t("cardPlanPageSize")}</td>
            <td className="p-3">{cardLimits.patientCardPlanPageSize}</td>
          </tr>
        </tbody>
      </table>
      <ModalShell open={open} title={t("editClinic")} onClose={() => setOpen(false)}>
        <label className="mb-3 block text-[13px]">
          {t("clinicName")}
          <input
            className={`mt-1 w-full ${MODAL_INPUT_CLASS}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <fieldset className="mb-4 space-y-2 text-[13px]">
          <legend className="font-medium">{t("enabledPresets")}</legend>
          {ALL_CLINIC_PRESETS.map((code) => (
            <label key={code} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draftPresets.includes(code)}
                onChange={() => togglePreset(code)}
              />
              {PRESET_LABELS[code] ?? code}
            </label>
          ))}
        </fieldset>
        <fieldset className="grid gap-3 text-[13px] sm:grid-cols-2">
          <legend className="mb-1 font-medium sm:col-span-2">{t("cardLimitsTitle")}</legend>
          {(
            [
              ["patientCardResultsPreview", "cardResultsPreview"],
              ["patientCardPlanPreview", "cardPlanPreview"],
              ["patientCardHistoryPageSize", "cardHistoryPageSize"],
              ["patientCardPlanPageSize", "cardPlanPageSize"],
            ] as const
          ).map(([key, labelKey]) => (
            <label key={key} className="block">
              {t(labelKey)}
              <input
                type="number"
                min={key.includes("Page") ? 10 : 1}
                max={key.includes("Page") ? 100 : 50}
                className={`mt-1 w-full ${MODAL_INPUT_CLASS}`}
                value={draftCard[key]}
                onChange={(e) =>
                  setDraftCard((prev) => ({
                    ...prev,
                    [key]: Number(e.target.value) || prev[key],
                  }))
                }
              />
            </label>
          ))}
        </fieldset>
        <ModalFooter onCancel={() => setOpen(false)} onSubmit={() => void save()} submitLabel={tc("save")} />
      </ModalShell>
    </div>
  );
}
