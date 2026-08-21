"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  FORM_STACK_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";
import { IcdPicker } from "@/components/IcdPicker";

export default function AdminIcdFavoritesPage() {
  const t = useTranslations("icd");
  const tc = useTranslations("common");
  const [codes, setCodes] = useState<string[]>([]);
  const [version, setVersion] = useState<{
    version: string;
    count: number;
    syncedAt: string | null;
    source: string;
  } | null>(null);
  const [pickId, setPickId] = useState("");
  const [retireCode, setRetireCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/icd-favorites");
    const data = await res.json();
    setCodes(data.codes ?? data.data?.codes ?? []);
    setVersion(data.version ?? data.data?.version ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(next: string[]) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/icd-favorites", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codes: next }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error ?? tc("saveFailed"));
      return;
    }
    setCodes(next);
    setMsg(tc("saved"));
  }

  async function syncCatalog() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/icd-favorites?action=sync", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? t("syncOk", { count: data.loaded ?? data.count ?? "—" }) : data.error ?? tc("failed"));
    await load();
  }

  async function retire() {
    if (!retireCode.trim()) return;
    setBusy(true);
    const res = await fetch("/api/admin/icd-favorites?action=retire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: retireCode.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? t("retireOk", { code: retireCode.trim() }) : data.error ?? tc("failed"));
    setRetireCode("");
  }

  return (
    <>
      <PageHeader title={t("favoritesTitle")} subtitle={t("favoritesSubtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
        {version ? (
          <p className={`text-sm ${TEXT_MUTED_CLASS}`}>
            {t("catalogVersion", {
              version: version.version,
              count: String(version.count),
              source: version.source,
            })}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void syncCatalog()}>
            {t("syncCatalog")}
          </button>
        </div>
        <div className={FORM_STACK_CLASS}>
          <IcdPicker
            label={t("addFavorite")}
            valueId={pickId}
            onChange={(id, item) => {
              setPickId(id);
              if (item?.code && !codes.includes(item.code)) {
                void save([...codes, item.code]);
                setPickId("");
              }
            }}
          />
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {codes.map((c) => (
              <li key={c} className="flex items-center gap-2">
                <span>{c}</span>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => void save(codes.filter((x) => x !== c))}
                >
                  {tc("delete")}
                </button>
              </li>
            ))}
            {codes.length === 0 ? <li className={`list-none ${TEXT_MUTED_CLASS}`}>—</li> : null}
          </ul>
        </div>
        <div className="space-y-2 border-t pt-3">
          <h3 className="font-semibold">{t("retireTitle")}</h3>
          <Field
            label={t("retireCode")}
            preset="code"
            value={retireCode}
            onChange={(e) => setRetireCode(e.target.value)}
          />
          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => void retire()}>
            {t("retireSubmit")}
          </button>
        </div>
        {msg ? <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{msg}</p> : null}
      </div>
    </>
  );
}
