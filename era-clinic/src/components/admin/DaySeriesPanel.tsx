"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  Field,
  MODAL_CHECKBOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";

type Member = { procedureCode: string; shortMark: string };
type Series = { id: string; code: string; name: string; fillsRestDays: boolean; members: Member[] };

export function DaySeriesPanel({ procedureOptions }: { procedureOptions: Array<{ value: string; label: string }> }) {
  const t = useTranslations("procedureRules");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<Series[]>([]);
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
    setRows((json.data ?? json) as Series[]);
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const pending =
      procedureCode && shortMark.trim()
        ? [...members, { procedureCode, shortMark: shortMark.trim() }]
        : members;
    if (!pending.length) return;
    const res = await fetch("/api/admin/procedure-day-series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name, fillsRestDays, members: pending }),
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, tc("saveFailed"));
      return;
    }
    showSuccess(tc("saved"));
    setCode("");
    setName("");
    setProcedureCode("");
    setShortMark("");
    setMembers([]);
    await load();
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? <p className="text-sm text-[#7F8C8D]">{t("empty")}</p> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded border border-[#D5DADF] p-2 text-sm">
            <div className="font-medium">{row.name}</div>
            <div className="text-[#7F8C8D]">
              {row.members.map((member) => `${member.shortMark} ${member.procedureCode}`).join(" · ")}
            </div>
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
      <div className="flex gap-2">
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => {
            if (!procedureCode || !shortMark.trim()) return;
            setMembers((prev) => [...prev, { procedureCode, shortMark: shortMark.trim() }]);
            setShortMark("");
          }}
        >
          {tc("add")}
        </button>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={!code.trim() || !name.trim() || (members.length === 0 && !(procedureCode && shortMark.trim()))}
          onClick={() => void save()}
        >
          {tc("save")}
        </button>
      </div>
      <p className="text-[12px] text-[#7F8C8D]">{members.map((member) => member.shortMark).join(" ")}</p>
    </div>
  );
}
