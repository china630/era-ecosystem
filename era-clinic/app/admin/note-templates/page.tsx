"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import type { L10n } from "@/domain/notes/note-template.types";

type TemplateRow = {
  id: string;
  code: string;
  title: L10n;
  specialty: string | null;
  isActive: boolean;
  version: number;
  sections: unknown;
};

export default function NoteTemplatesAdminPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [editJson, setEditJson] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/note-templates?includeInactive=1");
    const json = await res.json();
    const items = (json.data?.items ?? json.items ?? []) as TemplateRow[];
    setRows(Array.isArray(items) ? items : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSections() {
    if (!editId) return;
    setBusy(true);
    try {
      let sections: unknown;
      try {
        sections = JSON.parse(editJson) as unknown;
      } catch {
        return;
      }
      await fetch(`/api/admin/note-templates/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader className="!mb-0" title={t("noteTemplatesTitle")} />
      <p className="text-[13px] text-[#7F8C8D]">{t("noteTemplatesHint")}</p>
      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("code")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("name")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("version")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.title?.en ?? row.code}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.version}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    onClick={() => {
                      setEditId(row.id);
                      setEditJson(JSON.stringify(row.sections, null, 2));
                      setOpen(true);
                    }}
                  >
                    {tc("edit")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ModalShell open={open} title={t("noteTemplatesEditSections")} onClose={() => setOpen(false)}>
        <textarea
          className="h-64 w-full rounded border border-slate-300 p-2 font-mono text-xs"
          value={editJson}
          onChange={(e) => setEditJson(e.target.value)}
        />
        <ModalFooter
          onCancel={() => setOpen(false)}
          onSubmit={() => void saveSections()}
          submitLabel={busy ? tc("saving") : tc("save")}
        />
      </ModalShell>
    </div>
  );
}