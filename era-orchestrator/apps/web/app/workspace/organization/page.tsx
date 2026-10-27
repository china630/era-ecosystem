"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { orchFetch } from "../../../lib/orch-api";
import { useAuth } from "../../../lib/auth-context";

type Contact = {
  id?: string;
  kind: string;
  value: string;
  label?: string | null;
  purpose: string;
  isPrimary: boolean;
  sortOrder: number;
};

type Address = {
  id?: string;
  kind: string;
  line1: string;
  line2?: string | null;
  city?: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

type Profile = {
  organizationId: string;
  legalName: string;
  tradeName?: string | null;
  directorName?: string | null;
  directorTitle?: string | null;
  logoUrl?: string | null;
  bankLine?: string | null;
  operatingMode?: string;
  parentOrganizationId?: string | null;
  contacts: Contact[];
  addresses: Address[];
  print?: Record<string, string>;
};

const CONTACT_KIND_OPTIONS = [
  "PHONE",
  "MOBILE",
  "EMAIL",
  "WEBSITE",
  "WHATSAPP",
  "TELEGRAM",
  "FAX",
].map((code) => ({ value: code, label: code }));
const ADDRESS_KIND_OPTIONS = ["LEGAL", "POSTAL", "SITE", "BRANCH"].map(
  (code) => ({ value: code, label: code }),
);
const PURPOSE_OPTIONS = [
  "GENERAL",
  "LEGAL",
  "BILLING",
  "BOOKING",
  "EMERGENCY",
  "PRINT",
].map((code) => ({ value: code, label: code }));

export default function OrganizationProfilePage() {
  const { ready } = useRequireAuth();
  const { token } = useAuth();
  const t = useTranslations("orgProfile");
  const saveLabel = t("save");
  const savingLabel = t("saving");
  const removeLabel = t("remove");
  const reloadLabel = t("reload");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [tradeName, setTradeName] = useState("");
  const [directorName, setDirectorName] = useState("");
  const [directorTitle, setDirectorTitle] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bankLine, setBankLine] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const res = await orchFetch("/platform/v1/organizations/me/profile", {
      token,
    });
    if (!res.ok) {
      setError(t("loadError"));
      return;
    }
    const data = (await res.json()) as Profile;
    setProfile(data);
    setTradeName(data.tradeName ?? "");
    setDirectorName(data.directorName ?? "");
    setDirectorTitle(data.directorTitle ?? "");
    setLogoUrl(data.logoUrl ?? "");
    setBankLine(data.bankLine ?? "");
    setContacts(data.contacts?.length ? data.contacts : []);
    setAddresses(data.addresses?.length ? data.addresses : []);
  }, [token, t]);

  useEffect(() => {
    if (ready && token) void load();
  }, [ready, token, load]);

  async function save() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await orchFetch("/platform/v1/organizations/me/profile", {
      token,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tradeName: tradeName.trim() || null,
        directorName: directorName.trim() || null,
        directorTitle: directorTitle.trim() || null,
        logoUrl: logoUrl.trim() || null,
        bankLine: bankLine.trim() || null,
        contacts: contacts.map((c, i) => ({
          ...c,
          value: c.value.trim(),
          sortOrder: i,
        })),
        addresses: addresses.map((a, i) => ({
          ...a,
          line1: a.line1.trim(),
          sortOrder: i,
        })),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(
        typeof body?.message === "string"
          ? body.message
          : body?.code ?? t("saveError"),
      );
      return;
    }
    setSaved(true);
    await load();
  }

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {profile?.operatingMode === "DEPARTMENT" ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("departmentBanner")}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-emerald-700">{t("saved")}</p>
      ) : null}

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="text-sm font-semibold">{t("legalBlock")}</h2>
        <label className="block text-xs text-[#7F8C8D]">
          {t("legalName")}
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={profile?.legalName ?? ""}
            readOnly
            disabled
          />
        </label>
        <label className="block text-xs text-[#7F8C8D]">
          {t("tradeName")}
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={tradeName}
            onChange={(e) => setTradeName(e.target.value)}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-[#7F8C8D]">
            {t("directorName")}
            <input
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={directorName}
              onChange={(e) => setDirectorName(e.target.value)}
            />
          </label>
          <label className="block text-xs text-[#7F8C8D]">
            {t("directorTitle")}
            <input
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={directorTitle}
              onChange={(e) => setDirectorTitle(e.target.value)}
            />
          </label>
        </div>
        <label className="block text-xs text-[#7F8C8D]">
          {t("logoUrl")}
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://"
          />
        </label>
        <label className="block text-xs text-[#7F8C8D]">
          {t("bankLine")}
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={bankLine}
            onChange={(e) => setBankLine(e.target.value)}
          />
        </label>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("contacts")}</h2>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() =>
              setContacts((prev) => [
                ...prev,
                {
                  kind: "PHONE",
                  value: "+994",
                  purpose: "GENERAL",
                  isPrimary: prev.filter((c) => c.kind === "PHONE").length === 0,
                  sortOrder: prev.length,
                },
              ])
            }
          >
            {t("addContact")}
          </button>
        </div>
        {contacts.length === 0 ? (
          <p className="text-xs text-[#7F8C8D]">{t("contactsEmpty")}</p>
        ) : null}
        {contacts.map((c, idx) => (
          <div key={idx} className="grid gap-2 rounded border p-2 sm:grid-cols-6">
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("contactKind")}
              value={c.kind}
              options={CONTACT_KIND_OPTIONS}
              onChange={(next) => {
                const kind = String(next);
                setContacts((prev) =>
                  prev.map((row, i) => (i === idx ? { ...row, kind } : row)),
                );
              }}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("purpose")}
              value={c.purpose}
              options={PURPOSE_OPTIONS}
              onChange={(next) => {
                const purpose = String(next);
                setContacts((prev) =>
                  prev.map((row, i) => (i === idx ? { ...row, purpose } : row)),
                );
              }}
            />
            <input
              className="sm:col-span-2 rounded border px-2 py-1 text-sm self-end"
              value={c.value}
              aria-label={t("contactValue")}
              onChange={(e) => {
                const value = e.target.value;
                setContacts((prev) =>
                  prev.map((row, i) => (i === idx ? { ...row, value } : row)),
                );
              }}
            />
            <label className="flex items-center gap-1 text-xs self-end pb-2">
              <input
                type="checkbox"
                checked={c.isPrimary}
                onChange={(e) => {
                  const isPrimary = e.target.checked;
                  setContacts((prev) =>
                    prev.map((row, i) => {
                      if (i === idx) return { ...row, isPrimary };
                      if (isPrimary && row.kind === c.kind) {
                        return { ...row, isPrimary: false };
                      }
                      return row;
                    }),
                  );
                }}
              />
              {t("primary")}
            </label>
            <button
              type="button"
              className="text-xs text-red-600 self-end pb-2"
              onClick={() =>
                setContacts((prev) => prev.filter((_, i) => i !== idx))
              }
            >
              {removeLabel}
            </button>
          </div>
        ))}
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("addresses")}</h2>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() =>
              setAddresses((prev) => [
                ...prev,
                {
                  kind: "LEGAL",
                  line1: "",
                  isPrimary: prev.filter((a) => a.kind === "LEGAL").length === 0,
                  sortOrder: prev.length,
                },
              ])
            }
          >
            {t("addAddress")}
          </button>
        </div>
        {addresses.map((a, idx) => (
          <div key={idx} className="grid gap-2 rounded border p-2 sm:grid-cols-4">
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("addressKind")}
              value={a.kind}
              options={ADDRESS_KIND_OPTIONS}
              onChange={(next) => {
                const kind = String(next);
                setAddresses((prev) =>
                  prev.map((row, i) => (i === idx ? { ...row, kind } : row)),
                );
              }}
            />
            <input
              className="sm:col-span-2 rounded border px-2 py-1 text-sm self-end"
              value={a.line1}
              placeholder={t("addressLine")}
              onChange={(e) => {
                const line1 = e.target.value;
                setAddresses((prev) =>
                  prev.map((row, i) => (i === idx ? { ...row, line1 } : row)),
                );
              }}
            />
            <button
              type="button"
              className="text-xs text-red-600 self-end pb-2"
              onClick={() =>
                setAddresses((prev) => prev.filter((_, i) => i !== idx))
              }
            >
              {removeLabel}
            </button>
          </div>
        ))}
      </section>

      <div className="flex gap-2">
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? savingLabel : saveLabel}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => void load()}
        >
          {reloadLabel}
        </button>
      </div>
    </div>
  );
}
