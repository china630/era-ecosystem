"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { cpAdminFetch } from "../../../lib/cp-admin-fetch";
import { orchFetch } from "../../../lib/orch-api";
import { useAuth } from "../../../lib/auth-context";

type Partner = {
  id: string;
  code: string;
  displayName: string;
  isCorporate: boolean;
  fixedRatePercent?: string | number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  ownerUserId?: string | null;
};

export default function SuperAdminReferralsPage() {
  const t = useTranslations("superAdmin.referrals");
  const { token } = useAuth();
  const [items, setItems] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isCorporate, setIsCorporate] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await cpAdminFetch("referrals/partners");
    if (!res.ok) {
      setError(t("loadFailed"));
      setItems([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as Partner[];
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPartner(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await cpAdminFetch("referrals/partners", {
        method: "POST",
        body: JSON.stringify({
          displayName: displayName.trim(),
          contactEmail: contactEmail.trim() || null,
          isCorporate,
        }),
      });
      if (!res.ok) {
        setError(t("createFailed"));
        return;
      }
      setDisplayName("");
      setContactEmail("");
      setIsCorporate(false);
      setMsg(t("createOk"));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleCorporate(p: Partner) {
    setBusy(true);
    setError(null);
    try {
      const res = await cpAdminFetch(`referrals/partners/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isCorporate: !p.isCorporate }),
      });
      if (!res.ok) {
        setError(t("patchFailed"));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function downloadQr(id: string) {
    if (!token) return;
    const res = await orchFetch(`/v1/admin/referrals/partners/${id}/qr.png`, {
      token,
    });
    if (!res.ok) {
      setError(t("qrFailed"));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `partner-qr-${id.slice(0, 8)}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#34495E]">{t("title")}</h1>
      <p className="text-sm text-[#7F8C8D]">{t("hint")}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

      <form
        onSubmit={(e) => void createPartner(e)}
        className={`${CARD_CONTAINER_CLASS} flex flex-wrap gap-2 p-4`}
      >
        <input
          className={MODAL_INPUT_CLASS}
          placeholder={t("displayName")}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
        <input
          className={MODAL_INPUT_CLASS}
          placeholder={t("contactEmail")}
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isCorporate}
            onChange={(e) => setIsCorporate(e.target.checked)}
          />
          {t("corporate")}
        </label>
        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
          {t("create")}
        </button>
      </form>

      <div className={CARD_CONTAINER_CLASS}>
        {loading ? (
          <p className="p-4 text-sm text-[#7F8C8D]">{t("loading")}</p>
        ) : (
          <ul className="divide-y divide-[#EBEDF0]">
            {items.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-[#34495E]">
                    {p.displayName}{" "}
                    <span className="font-mono text-xs text-[#7F8C8D]">{p.code}</span>
                  </p>
                  <p className="text-xs text-[#7F8C8D]">
                    {p.isCorporate ? t("corporate") : t("individual")}
                    {p.contactEmail ? ` · ${p.contactEmail}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void toggleCorporate(p)}
                  >
                    {t("toggleCorporate")}
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => void downloadQr(p.id)}
                  >
                    QR
                  </button>
                </div>
              </li>
            ))}
            {items.length === 0 ? (
              <li className="p-4 text-sm text-[#7F8C8D]">{t("empty")}</li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  );
}
