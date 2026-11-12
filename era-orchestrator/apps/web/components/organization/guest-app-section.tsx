"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { orchFetch } from "../../lib/orch-api";
import { GuestAppPhonePreview } from "./guest-app-phone-preview";

type Brand = {
  enabled: boolean;
  displayName: string | null;
  primaryColor: string | null;
  logoUrl: string | null;
  locale: string | null;
  deskPhone: string | null;
  catalogJson?: unknown;
  postStayMessage?: string | null;
  offersJson?: unknown;
  doctorOnDutyPhone?: string | null;
  leadAlertMinutes?: number | null;
};

const LOCALES = [
  { value: "az", label: "az" },
  { value: "ru", label: "ru" },
  { value: "en", label: "en" },
];

export function GuestAppSection({ token }: { token: string }) {
  const t = useTranslations("guestApp");
  const [enabled, setEnabled] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1F6F5B");
  const [logoUrl, setLogoUrl] = useState("");
  const [locale, setLocale] = useState("az");
  const [deskPhone, setDeskPhone] = useState("");
  const [postStayMessage, setPostStayMessage] = useState("");
  const [doctorOnDutyPhone, setDoctorOnDutyPhone] = useState("");
  const [leadAlertMinutes, setLeadAlertMinutes] = useState("10");
  const [catalogText, setCatalogText] = useState("[]");
  const [offersText, setOffersText] = useState("[]");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await orchFetch("/platform/v1/organizations/me/guest-app", { token });
    if (!res.ok) {
      setError(t("loadError"));
      return;
    }
    const data = (await res.json()) as Brand;
    setEnabled(data.enabled);
    setDisplayName(data.displayName ?? "");
    setPrimaryColor(data.primaryColor ?? "#1F6F5B");
    setLogoUrl(data.logoUrl ?? "");
    setLocale(data.locale ?? "az");
    setDeskPhone(data.deskPhone ?? "");
    setPostStayMessage(data.postStayMessage ?? "");
    setDoctorOnDutyPhone(data.doctorOnDutyPhone ?? "");
    setLeadAlertMinutes(String(data.leadAlertMinutes ?? 10));
    setCatalogText(JSON.stringify(data.catalogJson ?? [], null, 0));
    setOffersText(JSON.stringify(data.offersJson ?? [], null, 0));
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(null);
    let catalogJson: unknown = [];
    let offersJson: unknown = [];
    try {
      catalogJson = JSON.parse(catalogText || "[]");
      offersJson = JSON.parse(offersText || "[]");
    } catch {
      setBusy(false);
      setError(t("saveError"));
      return;
    }
    const res = await orchFetch("/platform/v1/organizations/me/guest-app", {
      token,
      method: "PATCH",
      body: JSON.stringify({
        enabled,
        displayName,
        primaryColor,
        logoUrl,
        locale,
        deskPhone,
        postStayMessage,
        doctorOnDutyPhone,
        leadAlertMinutes: Number(leadAlertMinutes) || 10,
        catalogJson,
        offersJson,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(t("saveError"));
      return;
    }
    setSaved(true);
    await load();
  }

  return (
    <section className={`${CARD_CONTAINER_CLASS} mt-6 p-4`}>
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <p className="mb-4 text-sm text-[#7F8C8D]">{t("subtitle")}</p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            {t("enabled")}
          </label>
          <label className="block text-sm">
            {t("displayName")}
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            {t("color")}
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            {t("logo")}
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
          </label>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("locale")}
            value={locale}
            options={LOCALES}
            onChange={(next) => setLocale(String(next))}
          />
          <label className="block text-sm">
            {t("deskPhone")}
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={deskPhone}
              onChange={(e) => setDeskPhone(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            {t("doctorOnDuty")}
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={doctorOnDutyPhone}
              onChange={(e) => setDoctorOnDutyPhone(e.target.value)}
            />
          </label>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("leadAlert")}
            value={leadAlertMinutes}
            options={[
              { value: "5", label: "5" },
              { value: "10", label: "10" },
            ]}
            onChange={(next) => setLeadAlertMinutes(String(next))}
          />
          <label className="block text-sm">
            {t("postStay")}
            <textarea
              className="mt-1 w-full rounded border px-2 py-1"
              rows={3}
              value={postStayMessage}
              onChange={(e) => setPostStayMessage(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            {t("catalogJson")}
            <textarea
              className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
              rows={3}
              value={catalogText}
              onChange={(e) => setCatalogText(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            {t("offersJson")}
            <textarea
              className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
              rows={3}
              value={offersText}
              onChange={(e) => setOffersText(e.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {saved ? <p className="text-sm text-[#1F6F5B]">{t("saved")}</p> : null}
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? t("saving") : t("save")}
          </button>
        </div>
        <GuestAppPhonePreview
          enabled={enabled}
          displayName={displayName}
          primaryColor={primaryColor}
          logoUrl={logoUrl}
          locale={locale}
          deskPhone={deskPhone}
          doctorOnDutyPhone={doctorOnDutyPhone}
          postStayMessage={postStayMessage}
          catalogText={catalogText}
          offersText={offersText}
          leadAlertMinutes={leadAlertMinutes}
        />
      </div>
    </section>
  );
}
