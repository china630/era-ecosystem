"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@era/i18n-common";
import {
  AuthLoginCard,
  AuthPublicShell,
  buildAuthLoginLabels,
  parseApiError,
} from "@era/satellite-kit/ui";
import { orchFetch } from "../../../lib/orch-api";

type Property = {
  grantId: string;
  organizationId: string;
  organizationName: string;
  agencyId: string;
  agencyCode: string | null;
  agencyVoen: string;
  hotelBaseUrl: string | null;
};

export default function AgencyPortalLoginPage() {
  const tAuth = useTranslations("auth");
  const t = useTranslations("portalLogin");
  const locale = useLocale() as Locale;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch("/agency-portal/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError(parseApiError(await res.text().catch(() => null), tAuth("loginFailed")));
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
        properties: Property[];
      };
      setToken(data.accessToken);
      setProperties(data.properties ?? []);
      if ((data.properties ?? []).length === 1 && data.properties[0]) {
        await openProperty(data.accessToken, data.properties[0].grantId);
      }
    } catch {
      setError(tAuth("loginFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function openProperty(accessToken: string, grantId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch("/agency-portal/properties/pick", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ grantId }),
      });
      if (!res.ok) {
        setError(t("openHotelFailed"));
        return;
      }
      const ticket = (await res.json()) as { launchUrl?: string | null };
      if (!ticket.launchUrl) {
        setError(t("hotelUrlMissing"));
        return;
      }
      window.location.assign(ticket.launchUrl);
    } catch {
      setError(t("openHotelFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (token) {
    return (
      <AuthPublicShell locale={locale} title={tAuth("loginTitle")}>
        <p className="mb-4 text-sm text-[#7F8C8D]">{t("pickHotel")}</p>
        {properties.length === 0 ? (
          <p className="text-sm text-amber-700">{t("noHotels")}</p>
        ) : (
          <ul className="space-y-2">
            {properties.map((p) => (
              <li key={p.grantId}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => openProperty(token, p.grantId)}
                  className="w-full rounded-lg border border-[#D5DADF] px-4 py-3 text-left hover:bg-[#F4F5F7]"
                >
                  <div className="font-medium text-[#34495E]">{p.organizationName}</div>
                  <div className="text-xs text-[#7F8C8D]">
                    {p.agencyCode ?? p.agencyId} · VÖEN {p.agencyVoen}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </AuthPublicShell>
    );
  }

  return (
    <AuthLoginCard
      locale={locale}
      labels={buildAuthLoginLabels(tAuth, { emailMode: true })}
      loginId={email}
      password={password}
      onLoginIdChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={onLogin}
      busy={busy}
      error={error ?? undefined}
      emailMode
      passwordMinLength={8}
      showAccountLinks={false}
    />
  );
}
