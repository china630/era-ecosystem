"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type HsPreview = {
  hsCode: string;
  description?: string | null;
  dutyRatePercent: number;
  vatRatePercent: number;
  excisePercent: number;
  rateDate: string;
  source: string;
};

export function HsPreviewCard() {
  const t = useTranslations("customs");
  const [hsCode, setHsCode] = useState("");
  const [preview, setPreview] = useState<HsPreview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const code = hsCode.replace(/\D/g, "");
    if (code.length < 4) {
      setErr(t("hsCodeRequired"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/hs-preview?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) {
        setPreview(null);
        setErr(data.error ?? t("hsPreviewFailed"));
        return;
      }
      setPreview(data as HsPreview);
    } catch {
      setErr(t("hsPreviewFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
      <h2 className="text-sm font-semibold text-[#34495E]">{t("hsPreviewTitle")}</h2>
      <p className="text-xs text-[#7F8C8D]">{t("hsPreviewHint")}</p>
      <div className="flex flex-wrap gap-2">
        <input
          className={MODAL_INPUT_CLASS}
          placeholder={t("hsCodePlaceholder")}
          value={hsCode}
          onChange={(e) => setHsCode(e.target.value)}
        />
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => void load()}>
          {t("hsPreviewLoad")}
        </button>
      </div>
      {err ? <p className="text-xs text-red-600">{err}</p> : null}
      {preview ? (
        <dl className="grid gap-1 text-xs text-[#34495E]">
          <div>
            <dt className="inline font-medium">{t("hsCode")}: </dt>
            <dd className="inline">{preview.hsCode}</dd>
          </div>
          {preview.description ? (
            <div>
              <dt className="inline font-medium">{t("hsDescription")}: </dt>
              <dd className="inline">{preview.description}</dd>
            </div>
          ) : null}
          <div>
            <dt className="inline font-medium">{t("dutyRate")}: </dt>
            <dd className="inline">{preview.dutyRatePercent}%</dd>
          </div>
          <div>
            <dt className="inline font-medium">{t("vatRate")}: </dt>
            <dd className="inline">{preview.vatRatePercent}%</dd>
          </div>
          <div>
            <dt className="inline font-medium">{t("hsSource")}: </dt>
            <dd className="inline">{preview.source}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
