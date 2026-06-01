"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { ShellHeader } from "../../../components/shell-header";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { orchFetch } from "../../../lib/orch-api";
import { useAuth } from "../../../lib/auth-context";

type AccessRequest = {
  id: string;
  userEmail?: string;
  message?: string | null;
  createdAt?: string;
};

export default function TeamSettingsPage() {
  const { ready } = useRequireAuth();
  const { token } = useAuth();
  const t = useTranslations("settings");
  const tTeam = useTranslations("settings.team");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await orchFetch("/team/access-requests", { token });
    if (!res.ok) {
      setError(await res.text().catch(() => tTeam("loadFailed")));
      return;
    }
    setRequests((await res.json()) as AccessRequest[]);
  }, [token, tTeam]);

  useEffect(() => {
    if (ready && token) void load();
  }, [ready, token, load]);

  async function decide(id: string, approve: boolean) {
    if (!token) return;
    const path = approve
      ? `/team/access-requests/${id}/approve`
      : `/team/access-requests/${id}/decline`;
    const res = await orchFetch(path, {
      method: "POST",
      token,
      body: approve ? JSON.stringify({ role: "USER" }) : undefined,
    });
    if (!res.ok) {
      setError(await res.text().catch(() => tTeam("actionFailed")));
      return;
    }
    await load();
  }

  if (!ready) return null;

  return (
    <>
      <ShellHeader />
      <Link href="/" className={SECONDARY_BUTTON_CLASS}>
        {t("home")}
      </Link>
      <h1 className="mt-4 text-xl font-semibold">{tTeam("title")}</h1>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <ul className={`${CARD_CONTAINER_CLASS} mt-4 divide-y divide-[#D5DADF]`}>
        {requests.length === 0 ? (
          <li className="p-4 text-sm text-[#7F8C8D]">{tTeam("noPending")}</li>
        ) : (
          requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <p className="text-sm font-medium">{r.userEmail ?? r.id}</p>
                {r.message ? (
                  <p className="text-xs text-[#7F8C8D]">{r.message}</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  onClick={() => void decide(r.id, true)}
                >
                  {tTeam("approve")}
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => void decide(r.id, false)}
                >
                  {tTeam("decline")}
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </>
  );
}
