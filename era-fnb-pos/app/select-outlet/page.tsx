"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AuthPublicShell,
  PRIMARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { useLocale } from "next-intl";
import type { Locale } from "@era/i18n-common";
import {
  capabilitiesFromOutletRow,
  homePathForCapabilities,
} from "@/lib/outlet-capabilities";

type OutletRow = {
  id: string;
  code: string;
  name: string;
  capTill?: boolean;
  capTables?: boolean;
  capBuffetPlanner?: boolean;
  shapeHint?: string | null;
};

export default function SelectOutletPage() {
  const t = useTranslations("selectOutlet");
  const tAuth = useTranslations("auth");
  const locale = useLocale() as Locale;
  const [outlets, setOutlets] = useState<OutletRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(() => {
    return fetch("/api/outlets")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows = Array.isArray(d?.outlets) ? (d.outlets as OutletRow[]) : [];
        setOutlets(rows);
        setLoadFailed(false);
        return rows;
      })
      .catch(() => {
        setLoadFailed(true);
        return [] as OutletRow[];
      });
  }, []);

  async function pick(outlet: OutletRow) {
    setBusy(true);
    try {
      const res = await fetch("/api/outlets/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outletId: outlet.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showApiError(data, t("selectFailed"));
        return;
      }
      const caps = capabilitiesFromOutletRow(outlet);
      window.location.href = homePathForCapabilities(caps);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load().then((rows) => {
      if (rows.length === 1) {
        void pick(rows[0]!);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-pick once on mount
  }, [load]);

  return (
    <AuthPublicShell
      locale={locale}
      title={t("title")}
      localeLabels={{
        groupAria: tAuth("localeToggleAria"),
        az: tAuth("localeAz"),
        ru: tAuth("localeRu"),
        en: tAuth("localeEn"),
      }}
    >
      <p className="mb-4 text-center text-sm text-[#7F8C8D]">{t("hint")}</p>
      {loadFailed ? (
        <p className="text-center text-sm text-[#E74C3C]">{t("loadFailed")}</p>
      ) : null}
      {outlets.length === 0 && !loadFailed ? (
        <p className="text-center text-sm text-[#7F8C8D]">{t("empty")}</p>
      ) : null}
      <div className="mx-auto grid max-w-lg gap-3">
        {outlets.map((o) => {
          const caps = capabilitiesFromOutletRow(o);
          return (
            <button
              key={o.id}
              type="button"
              disabled={busy}
              className={`${PRIMARY_BUTTON_CLASS} w-full justify-start px-4 py-4 text-left`}
              onClick={() => void pick(o)}
            >
              <span className="block text-base font-semibold">{o.name}</span>
              <span className="mt-1 block text-xs opacity-80">
                {o.code}
                {caps.shapeHint ? ` · ${t(`shape.${caps.shapeHint}`)}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </AuthPublicShell>
  );
}
