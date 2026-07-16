"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";
import type {
  DiagnosticCatalogGroup,
  L10n,
} from "@/domain/catalog/diagnostic-catalog-shared";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";

type FavoritesPayload = {
  keys: string[];
  mode: "first" | "only";
  groups: DiagnosticCatalogGroup[];
};

export default function CatalogFavoritesAdminPage() {
  const t = useTranslations("catalogFavorites");
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const [keys, setKeys] = useState<string[]>([]);
  const [mode, setMode] = useState<"first" | "only">("first");
  const [groups, setGroups] = useState<DiagnosticCatalogGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/catalog-favorites");
    const data = await res.json();
    const row = (data.data ?? data) as FavoritesPayload;
    setKeys(row.keys ?? []);
    setMode(row.mode === "only" ? "only" : "first");
    setGroups(row.groups ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const modalityGroups = useMemo(
    () => groups.filter((g) => g.category === null),
    [groups],
  );
  const categoryGroups = useMemo(
    () => groups.filter((g) => g.category !== null),
    [groups],
  );

  function toggle(key: string) {
    setKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/catalog-favorites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys, mode }),
    });
    setSaving(false);
    if (res.ok) setMsg(t("saved"));
    else setMsg(t("saveFailed"));
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex gap-2">
            <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={saving} onClick={() => void save()}>
              {tc("save")}
            </button>
            <Link href="/admin/catalog" className={SECONDARY_BUTTON_CLASS}>
              {tNav("catalog")}
            </Link>
          </div>
        }
      />

      <div className={`${CARD_CONTAINER_CLASS} space-y-6 p-6`}>
        {loading ? (
          <p className="text-[13px] text-[#7F8C8D]">{tc("loading")}</p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-[13px] font-medium">{t("displayMode")}</p>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "first"}
                  onChange={() => setMode("first")}
                />
                {t("modeFirst")}
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "only"}
                  onChange={() => setMode("only")}
                />
                {t("modeOnly")}
              </label>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium">{t("modalities")}</p>
              <div className="flex flex-wrap gap-2">
                {modalityGroups.map((g) => (
                  <label
                    key={g.key}
                    className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-[13px] ${
                      keys.includes(g.key) ? "border-[#2980B9] bg-blue-50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={keys.includes(g.key)}
                      onChange={() => toggle(g.key)}
                    />
                    {pickL10n(g.title as L10n, locale)}
                    <span className="text-[11px] text-[#7F8C8D]">({g.itemCodes.length})</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium">{t("categories")}</p>
              <ul className="max-h-96 space-y-1 overflow-y-auto rounded border p-2">
                {categoryGroups.map((g) => (
                  <li key={g.key}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={keys.includes(g.key)}
                        onChange={() => toggle(g.key)}
                      />
                      <span className="flex-1">{pickL10n(g.title as L10n, locale)}</span>
                      <span className="text-[11px] text-[#7F8C8D]">
                        {g.key} · {g.itemCodes.length}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            {msg && <p className="text-[13px] text-green-700">{msg}</p>}
            <p className="text-[12px] text-[#7F8C8D]">{t("hint")}</p>
          </>
        )}
      </div>
    </>
  );
}
