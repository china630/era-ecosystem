"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  Field,
  MODAL_CHECKBOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";

type Member = { procedureCode: string; shortMark: string };
type Series = { id: string; code: string; name: string; fillsRestDays: boolean; members: Member[] };

export function DaySeriesPanel({ procedureOptions }: { procedureOptions: Array<{ value: string; label: string }> }) {
  const t = useTranslations("procedureRules");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<Series[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [fillsRestDays, setFillsRestDays] = useState(false);
  const [procedureCode, setProcedureCode] = useState("");
  const [shortMark, setShortMark] = useState("");
  const [members, setMembers] = useState<Member[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/procedure-day-series");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      showApiError(json, tc("loadingFailed"));
      return;
    }
    const list = (json.data ?? json) as Series[];
    setRows(Array.isArray(list) ? list : []);
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  function openSeries(row: Series) {
    setEditingId(row.id);
    setCode(row.code);
    setName(row.name);
    setFillsRestDays(row.fillsRestDays);
    setMembers(row.members.map((member) => ({ procedureCode: member.procedureCode, shortMark: member.shortMark })));
    setProcedureCode("");
    setShortMark("");
  }

  function startNew() {
    setEditingId(null);
    setCode("");
    setName("");
    setFillsRestDays(false);
    setMembers([]);
    setProcedureCode("");
    setShortMark("");
  }

  function addMember() {
    if (!procedureCode || !shortMark.trim()) return;
    setMembers((prev) => {
      const next = prev.filter((member) => member.procedureCode !== procedureCode);
      return [...next, { procedureCode, shortMark: shortMark.trim() }];
    });
    setProcedureCode("");
    setShortMark("");
  }

  async function save() {
    const pending =
      procedureCode && shortMark.trim()
        ? [...members.filter((member) => member.procedureCode !== procedureCode), { procedureCode, shortMark: shortMark.trim() }]
        : members;
    if (!pending.length) return;
    const res = await fetch("/api/admin/procedure-day-series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId ?? undefined,
        code,
        name,
        fillsRestDays,
        members: pending,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, tc("saveFailed"));
      return;
    }
    const saved = (data.data ?? data) as Series;
    if (saved?.id) openSeries(saved);
    showSuccess(tc("saved"));
    await load();
  }

  async function remove(id: string) {
    if (!window.confirm(t("daySeriesConfirmDelete"))) return;
    const res = await fetch(`/api/admin/procedure-day-series?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showApiError(data, tc("failed"));
      return;
    }
    if (editingId === id) startNew();
    showSuccess(t("daySeriesDeleted"));
    await load();
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? <p className="text-sm text-[#7F8C8D]">{t("empty")}</p> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-2 rounded border border-[#D5DADF] p-2 text-sm">
            <div>
              <div className="font-medium">{row.name}</div>
              <div className="text-[#7F8C8D]">
                {row.members.map((member) => `${member.shortMark} ${member.procedureCode}`).join(" · ")}
              </div>
            </div>
            <span className="flex gap-1">
              <button type="button" className={TABLE_ROW_ICON_BTN_CLASS} aria-label={tc("edit")} onClick={() => openSeries(row)}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button type="button" className={TABLE_ROW_ICON_BTN_CLASS} aria-label={tc("delete")} onClick={() => void remove(row.id)}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field preset="code" label={t("daySeriesCode")} value={code} onChange={(e) => setCode(e.target.value)} />
        <Field preset="shortText" label={t("daySeriesName")} value={name} onChange={(e) => setName(e.target.value)} />
        <CatalogField
          kind="SEARCHABLE"
          label={t("daySeriesProcedure")}
          value={procedureCode}
          onChange={(value) => setProcedureCode(String(value ?? ""))}
          options={procedureOptions}
        />
        <Field
          preset="code"
          label={t("daySeriesMark")}
          value={shortMark}
          onChange={(e) => setShortMark(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className={MODAL_CHECKBOX_CLASS} checked={fillsRestDays} onChange={(e) => setFillsRestDays(e.target.checked)} />
        {t("daySeriesFillsRest")}
      </label>
      {members.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {members.map((member) => (
            <li key={member.procedureCode} className="flex items-center justify-between gap-2">
              <span>
                {member.shortMark} · {member.procedureCode}
              </span>
              <button
                type="button"
                className={TABLE_ROW_ICON_BTN_CLASS}
                aria-label={tc("delete")}
                onClick={() => setMembers((prev) => prev.filter((item) => item.procedureCode !== member.procedureCode))}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={addMember}>
          {tc("add")}
        </button>
        {editingId ? (
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={startNew}>
            {tc("cancel")}
          </button>
        ) : null}
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={!code.trim() || !name.trim() || (members.length === 0 && !(procedureCode && shortMark.trim()))}
          onClick={() => void save()}
        >
          {tc("save")}
        </button>
      </div>
    </div>
  );
}
