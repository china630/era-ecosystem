"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CatalogField,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import type { L10n, NoteTemplateFieldDef, NoteTemplateSectionDef } from "@/domain/notes/note-template.types";

type NoteTemplateRow = {
  id: string;
  code: string;
  title: L10n;
  sections: { sections: NoteTemplateSectionDef[] };
};

type ClinicalNoteRow = {
  id: string;
  status: string;
  templateCode: string | null;
  payload: { fields?: Record<string, string> };
  signedAt: string | null;
};

type Props = {
  visitId: string;
};

function pickL10n(label: L10n | undefined, locale: string, fallback: string): string {
  if (!label) return fallback;
  if (locale === "az") return label.az || label.en || fallback;
  if (locale === "ru") return label.ru || label.en || fallback;
  return label.en || fallback;
}

export function VisitClinicalNotesPanel({ visitId }: Props) {
  const t = useTranslations("visits");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [templates, setTemplates] = useState<NoteTemplateRow[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<ClinicalNoteRow[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => templates.find((x) => x.id === templateId) ?? null,
    [templates, templateId],
  );

  const flatFields = useMemo(() => {
    const out: NoteTemplateFieldDef[] = [];
    for (const section of selected?.sections.sections ?? []) {
      for (const field of section.fields ?? []) out.push(field);
    }
    return out;
  }, [selected]);

  const loadNotes = useCallback(async () => {
    const res = await fetch(`/api/visits/${visitId}/notes`);
    if (!res.ok) return;
    const json = await res.json();
    const items = (json.data?.items ?? json.items ?? []) as ClinicalNoteRow[];
    setNotes(Array.isArray(items) ? items : []);
  }, [visitId]);

  useEffect(() => {
    void fetch("/api/clinical-note-templates")
      .then((r) => r.json())
      .then((raw) => {
        const items = (raw.data?.items ?? raw.items ?? []) as NoteTemplateRow[];
        setTemplates(Array.isArray(items) ? items : []);
      });
    void loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    setFieldValues({});
    setActiveNoteId(null);
  }, [templateId]);

  async function createNote() {
    if (!selected) {
      showApiError({ error: t("clinicalNotesPickTemplate") });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/visits/${visitId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selected.id, fieldValues }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc("saveFailed"));
        return;
      }
      const row = (data.data ?? data) as ClinicalNoteRow;
      setActiveNoteId(row.id);
      showSuccess(t("clinicalNotesSaved"));
      await loadNotes();
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!activeNoteId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/notes/${activeNoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldValues }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc("saveFailed"));
        return;
      }
      showSuccess(t("clinicalNotesSaved"));
      await loadNotes();
    } finally {
      setBusy(false);
    }
  }

  async function signNote() {
    if (!activeNoteId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/notes/${activeNoteId}/sign`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, t("clinicalNotesSignFailed"));
        return;
      }
      showSuccess(t("clinicalNotesSigned"));
      await loadNotes();
    } finally {
      setBusy(false);
    }
  }

  const options = templates.map((tpl) => ({
    value: tpl.id,
    label: `${tpl.code} · ${pickL10n(tpl.title, locale, tpl.code)}`,
  }));

  return (
    <div className="space-y-3 border-t pt-3">
      <h3 className="text-sm font-semibold">{t("clinicalNotesTitle")}</h3>
      <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("clinicalNotesSubtitle")}</p>
      <CatalogField
        kind="SEARCHABLE"
        label={t("clinicalNotesTemplate")}
        value={templateId}
        options={options}
        onChange={setTemplateId}
      />
      {flatFields.map((field) => (
        <label key={field.key} className="block space-y-1 text-sm">
          <span>
            {pickL10n(field.label, locale, field.key)}
            {field.required ? " *" : ""}
          </span>
          {field.quickAnswers?.length ? (
            <div className="flex flex-wrap gap-1">
              {field.quickAnswers.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => setFieldValues((prev) => ({ ...prev, [field.key]: q }))}
                >
                  {q}
                </button>
              ))}
            </div>
          ) : null}
          <textarea
            className="w-full rounded border border-slate-300 p-2 text-sm"
            rows={field.type === "textarea" ? 3 : 2}
            value={fieldValues[field.key] ?? ""}
            onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
          />
        </label>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void createNote()}>
          {t("clinicalNotesCreate")}
        </button>
        {activeNoteId ? (
          <>
            <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => void saveDraft()}>
              {tc("save")}
            </button>
            <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void signNote()}>
              {t("clinicalNotesSign")}
            </button>
          </>
        ) : null}
      </div>
      {notes.length > 0 ? (
        <ul className="space-y-1 text-[12px] text-slate-600">
          {notes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className="text-left underline"
                onClick={() => {
                  setActiveNoteId(n.id);
                  setFieldValues(n.payload?.fields ?? {});
                }}
              >
                {n.templateCode ?? "—"} · {n.status}
                {n.signedAt ? ` · ${n.signedAt.slice(0, 10)}` : ""}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("clinicalNotesEmpty")}</p>
      )}
    </div>
  );
}