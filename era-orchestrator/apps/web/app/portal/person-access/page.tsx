"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

const CONSENT_SESSION_KEY = "era_mdm_consent_session";

type AccessRequestRow = {
  id: string;
  requesterOrgId: string;
  requesterOrgName: string | null;
  purpose: string;
  createdAt: string;
};

function PersonAccessPortalInner() {
  const t = useTranslations("portal.personAccess");
  const searchParams = useSearchParams();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [requests, setRequests] = useState<AccessRequestRow[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const authHeaders = useCallback((): HeadersInit => {
    const token =
      sessionToken ??
      (typeof window !== "undefined"
        ? sessionStorage.getItem(CONSENT_SESSION_KEY)
        : null);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [sessionToken]);

  const loadRequests = useCallback(async () => {
    const res = await fetch("/api/portal/mdm/requests", {
      headers: authHeaders(),
    });
    if (!res.ok) {
      setMsg(t("sessionExpired"));
      return;
    }
    const data = (await res.json()) as { requests: AccessRequestRow[] };
    setRequests(data.requests ?? []);
  }, [authHeaders, t]);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? sessionStorage.getItem(CONSENT_SESSION_KEY)
        : null;
    if (stored) {
      setSessionToken(stored);
      return;
    }
    const guestToken = searchParams.get("token");
    if (!guestToken) return;
    setBusy(true);
    fetch("/api/portal/mdm/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: guestToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          setMsg(t("invalidToken"));
          return;
        }
        const data = (await res.json()) as { sessionToken: string };
        sessionStorage.setItem(CONSENT_SESSION_KEY, data.sessionToken);
        setSessionToken(data.sessionToken);
      })
      .finally(() => setBusy(false));
  }, [searchParams, t]);

  useEffect(() => {
    if (sessionToken) void loadRequests();
  }, [sessionToken, loadRequests]);

  async function decide(requestId: string, grant: boolean) {
    setBusy(true);
    setMsg("");
    const res = await fetch(
      `/api/portal/mdm/requests/${encodeURIComponent(requestId)}/decide`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ grant }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      setMsg(t("decideFailed"));
      return;
    }
    setMsg(grant ? t("grantedOk") : t("deniedOk"));
    await loadRequests();
  }

  if (!sessionToken && !searchParams.get("token")) {
    return (
      <div className={`${CARD_CONTAINER_CLASS} mx-auto max-w-lg p-6`}>
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="mt-2 text-sm text-[#7F8C8D]">{t("needToken")}</p>
      </div>
    );
  }

  return (
    <div className={`${CARD_CONTAINER_CLASS} mx-auto max-w-2xl space-y-4 p-6`}>
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <p className="text-sm text-[#7F8C8D]">{t("subtitle")}</p>
      {msg ? <p className="text-sm">{msg}</p> : null}
      {busy && !requests.length ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : null}
      {requests.length === 0 && sessionToken && !busy ? (
        <p className="text-sm text-[#7F8C8D]">{t("empty")}</p>
      ) : null}
      <ul className="space-y-3">
        {requests.map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-[#E5E7EB] p-4 text-sm"
          >
            <p className="font-medium">
              {r.requesterOrgName ?? r.requesterOrgId}
            </p>
            <p className="mt-1 text-[#7F8C8D]">{r.purpose}</p>
            <p className="mt-1 text-xs text-[#7F8C8D]">
              {new Date(r.createdAt).toLocaleString()}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void decide(r.id, true)}
              >
                {t("grant")}
              </button>
              <button
                type="button"
                className={GHOST_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void decide(r.id, false)}
              >
                {t("deny")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PersonAccessPortalPage() {
  return (
    <Suspense>
      <PersonAccessPortalInner />
    </Suspense>
  );
}
