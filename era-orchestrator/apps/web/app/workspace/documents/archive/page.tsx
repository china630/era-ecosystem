"use client";

import { FormEvent, useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  CARD_CONTAINER_CLASS,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import { useAuth } from "../../../../lib/auth-context";
import { getOrchAccessToken, orchFetch } from "../../../../lib/orch-api";
import { DocumentsNav } from "../../../../components/documents/documents-nav";

const KINDS = ["SITE", "ROOM", "RACK", "SHELF", "BOX", "FOLDER"];

type Location = { id: string; parentId: string | null; kind: string; name: string };

export default function DocumentArchivePage() {
  const { ready } = useRequireAuth();
  const { token } = useAuth();
  const t = useTranslations("documentsOffice");
  const [rows, setRows] = useState<Location[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("FOLDER");
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const tokenValue = getOrchAccessToken() ?? token;
    if (!tokenValue) return;
    const res = await orchFetch("/v1/documents/locations", { token: tokenValue });
    if (!res.ok) setError(t("loadFailed"));
    else setRows((await res.json()) as Location[]);
  }, [token, t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const tokenValue = getOrchAccessToken() ?? token;
    if (!tokenValue || !name.trim()) return;
    const res = await orchFetch("/v1/documents/locations", {
      token: tokenValue,
      method: "POST",
      body: JSON.stringify({ name: name.trim(), kind, parentId: parentId || undefined }),
    });
    if (!res.ok) {
      setError(t("saveFailed"));
      return;
    }
    setName("");
    await load();
  }

  if (!ready) return null;
  const byParent = new Map<string | null, Location[]>();
  for (const row of rows) {
    const key = row.parentId;
    byParent.set(key, [...(byParent.get(key) ?? []), row]);
  }
  function render(parentId: string | null, depth: number): ReactNode {
    return (byParent.get(parentId) ?? []).map((row) => (
      <li key={row.id} style={{ marginLeft: depth * 16 }}>
        {t(`location_${row.kind}`)} · {row.name}
        <ul>{render(row.id, depth + 1)}</ul>
      </li>
    ));
  }

  return (
    <div className="space-y-4 p-4">
      <PageHeader title={t("archiveTitle")} subtitle={t("archiveSubtitle")} />
      <DocumentsNav />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <form onSubmit={onCreate} className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <CatalogField kind="CLOSED_SMALL" label={t("fieldLocationKind")} value={kind} onChange={(v) => setKind(String(v))} options={KINDS.map((value) => ({ value, label: t(`location_${value}`) }))} />
        <CatalogField kind="SEARCHABLE" label={t("fieldParent")} value={parentId} onChange={(v) => setParentId(String(v))} options={rows.map((row) => ({ value: row.id, label: row.name }))} />
        <Field preset="shortText" label={t("fieldLocationName")} value={name} onChange={(e) => setName(e.target.value)} />
        <button className={PRIMARY_BUTTON_CLASS} type="submit">{t("createLocation")}</button>
      </form>
      <ul className={`${CARD_CONTAINER_CLASS} p-4 text-sm`}>{render(null, 0)}</ul>
    </div>
  );
}
