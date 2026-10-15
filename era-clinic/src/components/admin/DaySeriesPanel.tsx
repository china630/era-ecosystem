"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CatalogField, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, showApiError, showSuccess } from "@era/satellite-kit/ui";

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
    if (!res.ok) return;
    const json = await res.json();
    setRows((json.data ?? json) as Series[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const res = await fetch("/api/admin/procedure-day-series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name, fillsRestDays, members }),
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, tc("saveFailed"));
      return;
    }
    showSuccess(tc("saved"));
    setCode("");
    setName("");
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
        <label className="text-[12px] text-[#7F8C8D]">
          {t("daySeriesCode")}
          <input className="mt-1 w-full rounded border px-2 py-1 text-[13px]" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <label className="text-[12px] text-[#7F8C8D]">
          {t("daySeriesName")}
          <input className="mt-1 w-full rounded border px-2 py-1 text-[13px]" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <CatalogField
          kind="SEARCHABLE"
          label={t("daySeriesProcedure")}
          value={procedureCode}
          onChange={(value) => setProcedureCode(String(value ?? ""))}
          options={procedureOptions}
        />
        <label className="text-[12px] text-[#7F8C8D]">
          {t("daySeriesMark")}
          <input className="mt-1 w-full rounded border px-2 py-1 text-[13px]" value={shortMark} onChange={(e) => setShortMark(e.target.value)} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={fillsRestDays} onChange={(e) => setFillsRestDays(e.target.checked)} />
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
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={!code || !name} onClick={() => void save()}>
          {tc("save")}
        </button>
      </div>
      <p className="text-[12px] text-[#7F8C8D]">{members.map((member) => member.shortMark).join(" ")}</p>
    </div>
  );
}
