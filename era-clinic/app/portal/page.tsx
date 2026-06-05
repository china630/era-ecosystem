"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";

export default function PortalPage() {
  const t = useTranslations("portal");
  const [token, setToken] = useState("");
  const [data, setData] = useState<string>("");

  async function load() {
    const res = await fetch(`/api/portal/session?token=${encodeURIComponent(token)}`);
    setData(JSON.stringify(await res.json(), null, 2));
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <div className={`${CARD_CONTAINER_CLASS} mt-4 space-y-3 p-4`}>
        <input
          className="w-full rounded border px-2 py-1"
          placeholder={t("token")}
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
          {t("load")}
        </button>
        {data && <pre className="max-h-96 overflow-auto text-xs">{data}</pre>}
      </div>
    </main>
  );
}
