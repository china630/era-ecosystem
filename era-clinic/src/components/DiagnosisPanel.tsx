"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  FieldSelect,
  FieldTextarea,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";
import { IcdPicker } from "@/components/IcdPicker";

type DxRow = {
  id: string;
  role?: string;
  kind?: string;
  note?: string | null;
  icdCode: {
    code: string;
    titleEn: string;
    titleRu: string;
    titleAz?: string | null;
  };
};

type Props = {
  apiBase: string;
  title: string;
  showKind?: boolean;
  showRole?: boolean;
};

function titleFor(
  row: DxRow["icdCode"],
  locale: string,
): string {
  if (locale.startsWith("ru")) return row.titleRu;
  if (locale.startsWith("az")) return row.titleAz?.trim() || row.titleRu;
  return row.titleEn;
}

export function DiagnosisPanel({ apiBase, title, showKind, showRole = true }: Props) {
  const t = useTranslations("icd");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [items, setItems] = useState<DxRow[]>([]);
  const [open, setOpen] = useState(false);
  const [icdCodeId, setIcdCodeId] = useState("");
  const [note, setNote] = useState("");
  const [role, setRole] = useState("PRIMARY");
  const [kind, setKind] = useState("ADMISSION");
  const [chapter, setChapter] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(apiBase);
    const data = await res.json();
    setItems(data.items ?? data.data?.items ?? []);
  }, [apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!icdCodeId) {
      setMsg(t("codeRequired"));
      return;
    }
    setBusy(true);
    setMsg("");
    const res = await fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        icdCodeId,
        note: note || null,
        ...(showRole ? { role } : {}),
        ...(showKind ? { kind } : {}),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error ?? tc("failed"));
      return;
    }
    setOpen(false);
    setIcdCodeId("");
    setNote("");
    await load();
  }

  async function remove(id: string) {
    const res = await fetch(`${apiBase}?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) await load();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setOpen(true)}>
          {t("addDiagnosis")}
        </button>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((d) => (
          <li key={d.id} className="flex flex-wrap items-baseline gap-2">
            <span>
              {d.icdCode.code} — {titleFor(d.icdCode, locale)}
              {d.role ? ` (${d.role})` : ""}
              {d.kind ? ` · ${d.kind}` : ""}
              {d.note ? ` — ${d.note}` : ""}
            </span>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => void remove(d.id)}
            >
              {tc("delete")}
            </button>
          </li>
        ))}
        {items.length === 0 ? (
          <li className={`list-none ${TEXT_MUTED_CLASS}`}>—</li>
        ) : null}
      </ul>
      {msg ? <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{msg}</p> : null}
      <ModalShell
        open={open}
        title={t("addDiagnosis")}
        onClose={() => setOpen(false)}
        footer={
          <ModalFooter
            onCancel={() => setOpen(false)}
            onSubmit={() => void add()}
            busy={busy}
            submitLabel={t("addDiagnosis")}
          />
        }
      >
        <div className="space-y-3">
          <IcdPicker
            label={t("code")}
            valueId={icdCodeId}
            required
            showChapterFilter
            chapter={chapter}
            onChapterChange={setChapter}
            onChange={(id) => setIcdCodeId(id)}
          />
          {showRole ? (
            <FieldSelect
              label={t("role")}
              preset="select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="PRIMARY">{t("rolePrimary")}</option>
              <option value="SECONDARY">{t("roleSecondary")}</option>
            </FieldSelect>
          ) : null}
          {showKind ? (
            <FieldSelect
              label={t("admissionKind")}
              preset="select"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="ADMISSION">{t("kindAdmission")}</option>
              <option value="DISCHARGE">{t("kindDischarge")}</option>
            </FieldSelect>
          ) : null}
          <FieldTextarea
            label={t("note")}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </ModalShell>
    </div>
  );
}
