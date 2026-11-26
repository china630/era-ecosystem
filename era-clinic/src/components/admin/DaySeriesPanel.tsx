"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  Field,
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";

type Member = { procedureCode: string; shortMark: string };
type Series = {
  id: string;
  code: string;
  name: string;
  fillsRestDays: boolean;
  modeCode?: string | null;
  weeklyCap?: number | null;
  afternoonPinRetry?: boolean;
  members: Member[];
};
type ModeOpt = { code: string; baths: number; rest: number };

const DEFAULT_MODES: ModeOpt[] = [
  { code: "2", baths: 2, rest: 1 },
  { code: "3", baths: 3, rest: 1 },
  { code: "4", baths: 4, rest: 1 },
  { code: "5", baths: 5, rest: 1 },
  { code: "ALTERNATING", baths: 1, rest: 1 },
];

function markFor(code: string, existing: Member[]): string {
  const found = existing.find((row) => row.procedureCode === code);
  if (found?.shortMark) return found.shortMark;
  const parts = code.split("-").filter(Boolean);
  const last = parts[parts.length - 1] ?? code;
  return last.slice(0, 2).toUpperCase();
}

export function DaySeriesPanel({ procedureOptions }: { procedureOptions: Array<{ value: string; label: string }> }) {
  const t = useTranslations("procedureRules");
  const ts = useTranslations("adminSettings");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<Series[]>([]);
  const [modes, setModes] = useState<ModeOpt[]>(DEFAULT_MODES);
  const [defaultMode, setDefaultMode] = useState("3");
  const [clinicWeeklyCap, setClinicWeeklyCap] = useState("5");
  const [closedDaySpendsOwedRest, setClosedDaySpendsOwedRest] = useState(true);
  const [closedDayResetsOpenStreak, setClosedDayResetsOpenStreak] = useState(true);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [fillsRestDays, setFillsRestDays] = useState(false);
  const [modeCode, setModeCode] = useState<string>("");
  const [weeklyCap, setWeeklyCap] = useState<string>("");
  const [afternoonPinRetry, setAfternoonPinRetry] = useState(true);
  const [memberCodes, setMemberCodes] = useState<string[]>([]);
  const [memberMarks, setMemberMarks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [seriesRes, settingsRes] = await Promise.all([
      fetch("/api/admin/procedure-day-series"),
      fetch("/api/admin/settings"),
    ]);
    const seriesJson = await seriesRes.json().catch(() => ({}));
    if (!seriesRes.ok) {
      showApiError(seriesJson, tc("loadingFailed"));
      return;
    }
    const list = (seriesJson.data ?? seriesJson) as Series[];
    setRows(Array.isArray(list) ? list : []);
    if (settingsRes.ok) {
      const settingsJson = await settingsRes.json().catch(() => ({}));
      const row = (settingsJson.data ?? settingsJson) as Record<string, unknown>;
      const rawModes = row.bathDayModes;
      if (Array.isArray(rawModes) && rawModes.length > 0) {
        setModes(
          rawModes
            .map((item: { code?: string; baths?: number; rest?: number }) => ({
              code: String(item.code ?? "").toUpperCase(),
              baths: Number(item.baths) || 1,
              rest: Number(item.rest) || 0,
            }))
            .filter((item: ModeOpt) => item.code),
        );
      }
      if (row.defaultBathMode) setDefaultMode(String(row.defaultBathMode).toUpperCase());
      if (typeof row.weeklyNaftalanCap === "number") {
        setClinicWeeklyCap(String(row.weeklyNaftalanCap));
      }
      setClosedDaySpendsOwedRest(row.closedDaySpendsOwedRest !== false);
      setClosedDayResetsOpenStreak(row.closedDayResetsOpenStreak !== false);
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const modeOptions = useMemo(
    () =>
      modes.map((row) => ({
        value: row.code,
        label: `${row.code} (${row.baths}+${row.rest})`,
      })),
    [modes],
  );

  function openSeries(row: Series) {
    setEditingId(row.id);
    setCode(row.code);
    setName(row.name);
    setFillsRestDays(row.fillsRestDays);
    setModeCode(row.modeCode?.trim() ? String(row.modeCode).toUpperCase() : "");
    setWeeklyCap(row.weeklyCap == null ? "" : String(row.weeklyCap));
    setAfternoonPinRetry(row.afternoonPinRetry !== false);
    setMemberCodes(row.members.map((member) => member.procedureCode));
    setMemberMarks(
      Object.fromEntries(row.members.map((member) => [member.procedureCode, member.shortMark])),
    );
    setModalOpen(true);
  }

  function startNew() {
    setEditingId(null);
    setCode("");
    setName("");
    setFillsRestDays(false);
    setModeCode("");
    setWeeklyCap("");
    setAfternoonPinRetry(true);
    setMemberCodes([]);
    setMemberMarks({});
    setModalOpen(true);
  }

  function setMembersFromCodes(codes: string[]) {
    const nextCodes = codes.map(String);
    setMemberCodes(nextCodes);
    setMemberMarks((prev) => {
      const next = { ...prev };
      for (const c of nextCodes) {
        if (!next[c]) next[c] = markFor(c, []);
      }
      for (const key of Object.keys(next)) {
        if (!nextCodes.includes(key)) delete next[key];
      }
      return next;
    });
  }

  async function save() {
    const members = memberCodes
      .map((procedureCode) => ({
        procedureCode,
        shortMark: (memberMarks[procedureCode] ?? markFor(procedureCode, [])).trim(),
      }))
      .filter((row) => row.procedureCode && row.shortMark);
    if (!code.trim() || !name.trim() || members.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/procedure-day-series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId ?? undefined,
          code,
          name,
          fillsRestDays,
          modeCode: modeCode.trim() ? modeCode.trim().toUpperCase() : null,
          weeklyCap: weeklyCap.trim() === "" ? null : Number(weeklyCap),
          afternoonPinRetry,
          members,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc("saveFailed"));
        return;
      }
      showSuccess(tc("saved"));
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t("daySeriesConfirmDelete"))) return;
    const res = await fetch(`/api/admin/procedure-day-series?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showApiError(data, tc("failed"));
      return;
    }
    if (editingId === id) setModalOpen(false);
    showSuccess(t("daySeriesDeleted"));
    await load();
  }

  async function saveClinicDefaults() {
    setSavingDefaults(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultBathMode: defaultMode,
          weeklyNaftalanCap: Number(clinicWeeklyCap) || 0,
          closedDaySpendsOwedRest,
          closedDayResetsOpenStreak,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc("saveFailed"));
        return;
      }
      showSuccess(tc("saved"));
      await load();
    } finally {
      setSavingDefaults(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded border border-[#D5DADF] bg-white p-3">
        <h3 className="text-sm font-semibold text-[#2C3E50]">{t("daySeriesClinicDefaults")}</h3>
        <p className="text-xs text-[#7F8C8D]">{t("daySeriesClinicDefaultsHelp")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <CatalogField
            kind="CLOSED_SMALL"
            label={ts("defaultBathMode")}
            value={defaultMode}
            onChange={(value) => setDefaultMode(String(value ?? "3").toUpperCase())}
            options={modeOptions}
            emptyLabel={null}
          />
          <Field
            preset="code"
            label={ts("weeklyNaftalanCap")}
            value={clinicWeeklyCap}
            onChange={(e) => setClinicWeeklyCap(e.target.value)}
          />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className={`${MODAL_CHECKBOX_CLASS} mt-0.5`}
            checked={closedDaySpendsOwedRest}
            onChange={(e) => setClosedDaySpendsOwedRest(e.target.checked)}
          />
          <span className={MODAL_FIELD_LABEL_CLASS}>{ts("closedDaySpendsOwedRest")}</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className={`${MODAL_CHECKBOX_CLASS} mt-0.5`}
            checked={closedDayResetsOpenStreak}
            onChange={(e) => setClosedDayResetsOpenStreak(e.target.checked)}
          />
          <span className={MODAL_FIELD_LABEL_CLASS}>{ts("closedDayResetsOpenStreak")}</span>
        </label>
        <div className="flex justify-end">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={savingDefaults}
            onClick={() => void saveClinicDefaults()}
          >
            {tc("save")}
          </button>
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#7F8C8D] max-w-2xl">{t("daySeriesHelp")}</p>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={startNew}>
          {tc("add")}
        </button>
      </div>
      {rows.length === 0 ? <p className="text-sm text-[#7F8C8D]">{t("daySeriesEmpty")}</p> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-start justify-between gap-2 rounded border border-[#D5DADF] bg-white p-3 text-sm"
          >
            <div className="min-w-0 space-y-1">
              <div className="font-medium text-[#2C3E50]">{row.name}</div>
              <div className="text-[#7F8C8D] text-xs">{row.code}</div>
              <div className="text-[#7F8C8D]">
                {row.members.map((member) => `${member.shortMark} ${member.procedureCode}`).join(" · ")}
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {row.modeCode ? (
                  <span className="rounded bg-[#EEF2F5] px-1.5 py-0.5 text-xs">{row.modeCode}</span>
                ) : null}
                {row.weeklyCap != null ? (
                  <span className="rounded bg-[#EEF2F5] px-1.5 py-0.5 text-xs">
                    {t("daySeriesCapBadge", { n: row.weeklyCap })}
                  </span>
                ) : null}
                {row.fillsRestDays ? (
                  <span className="rounded bg-[#E8F5E9] px-1.5 py-0.5 text-xs text-[#2E7D32]">
                    {t("daySeriesFillsRestBadge")}
                  </span>
                ) : null}
              </div>
            </div>
            <span className="flex gap-1 shrink-0">
              <button
                type="button"
                className={TABLE_ROW_ICON_BTN_CLASS}
                aria-label={tc("edit")}
                onClick={() => openSeries(row)}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                className={TABLE_ROW_ICON_BTN_CLASS}
                aria-label={tc("delete")}
                onClick={() => void remove(row.id)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          </li>
        ))}
      </ul>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-4 shadow-lg space-y-3"
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-base font-semibold text-[#2C3E50]">
              {editingId ? tc("edit") : tc("add")} — {t("daySeriesTab")}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field preset="code" label={t("daySeriesCode")} value={code} onChange={(e) => setCode(e.target.value)} />
              <Field
                preset="shortText"
                label={t("daySeriesName")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("daySeriesMode")}
                value={modeCode}
                onChange={(value) => setModeCode(String(value ?? ""))}
                options={modeOptions}
                emptyLabel={t("daySeriesModeInherit")}
              />
              <Field
                preset="code"
                label={t("daySeriesWeeklyCap")}
                value={weeklyCap}
                onChange={(e) => setWeeklyCap(e.target.value)}
                placeholder={t("daySeriesWeeklyCapHint")}
                hint={t("daySeriesWeeklyCapHint")}
              />
            </div>
            <CatalogField
              kind="MULTI"
              label={t("daySeriesProcedures")}
              value={memberCodes}
              onChange={(value) =>
                setMembersFromCodes(Array.isArray(value) ? value.map(String) : value ? [String(value)] : [])
              }
              options={procedureOptions}
            />
            {memberCodes.length > 0 ? (
              <ul className="space-y-2 rounded border border-[#D5DADF] p-2">
                {memberCodes.map((procedureCode) => {
                  const label =
                    procedureOptions.find((opt) => opt.value === procedureCode)?.label ?? procedureCode;
                  return (
                    <li key={procedureCode} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-[#2C3E50]">{label}</span>
                      <Field
                        preset="code"
                        label={t("daySeriesMark")}
                        value={memberMarks[procedureCode] ?? ""}
                        onChange={(e) =>
                          setMemberMarks((prev) => ({ ...prev, [procedureCode]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        aria-label={tc("delete")}
                        onClick={() => setMembersFromCodes(memberCodes.filter((c) => c !== procedureCode))}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className={`${MODAL_CHECKBOX_CLASS} mt-0.5`}
                checked={fillsRestDays}
                onChange={(e) => setFillsRestDays(e.target.checked)}
              />
              <span>
                <span className={MODAL_FIELD_LABEL_CLASS}>{t("daySeriesFillsRest")}</span>
                <span className="block text-xs text-[#7F8C8D]">{t("daySeriesFillsRestHelp")}</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className={`${MODAL_CHECKBOX_CLASS} mt-0.5`}
                checked={afternoonPinRetry}
                onChange={(e) => setAfternoonPinRetry(e.target.checked)}
              />
              <span>
                <span className={MODAL_FIELD_LABEL_CLASS}>{t("daySeriesAfternoonRetry")}</span>
                <span className="block text-xs text-[#7F8C8D]">{t("daySeriesAfternoonRetryHelp")}</span>
              </span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setModalOpen(false)}>
                {tc("cancel")}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={saving || !code.trim() || !name.trim() || memberCodes.length === 0}
                onClick={() => void save()}
              >
                {tc("save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
