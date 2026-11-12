"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { bakuDateShort } from "@era/satellite-kit/time";
import { addHotelDays, hotelDateKey, parseHotelNoon } from "@/lib/hotel-calendar";
import { dayHeaderClass, shiftChipClass } from "@/lib/duty-schedules/shift-ui";
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_SHELL_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DatePicker,
  EraListFilterBar,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";

type Axis = { id: string; code: string; name: string; kind: string };
type ShiftCode = {
  code: string;
  label: string;
  startTime: string | null;
  endTime: string | null;
};
type Cell = {
  id: string;
  workDate: string;
  axisId: string;
  globalPersonId: string;
  personName: string;
  shiftCode: string;
  orphaned?: boolean;
  positionName?: string | null;
};
type Person = {
  globalPersonId: string;
  name: string;
  orgUnitId: string | null;
  orgUnitName: string | null;
  positionId: string | null;
  positionName: string | null;
};

type Props = {
  dept: "RECEPTION" | "SECURITY" | "ENGINEERING";
  title: string;
  subtitle: string;
};

function mondayOf(day: string) {
  const dow = parseHotelNoon(day).getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addHotelDays(day, diff);
}

export function DutyScheduleBoard({ dept, title, subtitle }: Props) {
  const t = useTranslations("dutySchedules");
  const tc = useTranslations("common");
  const today = hotelDateKey();
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [status, setStatus] = useState<"DRAFT" | "APPROVED">("DRAFT");
  const [axes, setAxes] = useState<Axis[]>([]);
  const [shiftCodes, setShiftCodes] = useState<ShiftCode[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [orgUnitIds, setOrgUnitIds] = useState<string[]>([]);
  const [orgUnitOptions, setOrgUnitOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [unavailable, setUnavailable] = useState(false);
  /** Settings stay collapsed; open only on demand (or empty axes seed fail). */
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editor, setEditor] = useState<{
    axisId: string;
    day: string;
    personId: string;
    shiftCode: string;
  } | null>(null);
  const [axisDraftCode, setAxisDraftCode] = useState("");
  const [axisDraftName, setAxisDraftName] = useState("");

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addHotelDays(weekStart, i)),
    [weekStart],
  );

  const weekLabel = useMemo(
    () => `${bakuDateShort(days[0]!)} – ${bakuDateShort(days[6]!)}`,
    [days],
  );

  const filterUnitOptions = useMemo(() => {
    const map = new Map(orgUnitOptions.map((o) => [o.value, o.label]));
    for (const id of orgUnitIds) {
      if (!map.has(id)) map.set(id, id);
    }
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [orgUnitOptions, orgUnitIds]);

  const load = useCallback(async () => {
    const qs = selectedUnit
      ? `?orgUnitId=${encodeURIComponent(selectedUnit)}`
      : "";
    // Week first so ensureDeptDefaults seeds before personnel (avoids parallel upsert races).
    const weekRes = await fetch(
      `/api/duty-schedules/${dept.toLowerCase()}/week?weekStart=${weekStart}`,
    );
    const weekJson = await weekRes.json();
    if (!weekRes.ok) {
      showApiError(weekJson, title);
      return;
    }
    const peopleRes = await fetch(
      `/api/duty-schedules/${dept.toLowerCase()}/personnel${qs}`,
    );
    const peopleJson = await peopleRes.json();
    if (!peopleRes.ok) {
      showApiError(peopleJson, title);
      return;
    }
    setStatus(weekJson.week?.status === "APPROVED" ? "APPROVED" : "DRAFT");
    setAxes(Array.isArray(weekJson.axes) ? weekJson.axes : []);
    setShiftCodes(Array.isArray(weekJson.shiftCodes) ? weekJson.shiftCodes : []);
    setCells(Array.isArray(weekJson.week?.cells) ? weekJson.week.cells : []);
    setUnavailable(
      Boolean(weekJson.workforceUnavailable || peopleJson.unavailable),
    );
    setOrgUnitIds(
      Array.isArray(peopleJson.binding?.orgUnitIds)
        ? peopleJson.binding.orgUnitIds
        : [],
    );
    setOrgUnitOptions(
      Array.isArray(peopleJson.orgUnitOptions) ? peopleJson.orgUnitOptions : [],
    );
    setPeople(Array.isArray(peopleJson.items) ? peopleJson.items : []);
  }, [dept, weekStart, selectedUnit, title]);

  useEffect(() => {
    void load();
  }, [load]);

  function cellsFor(axisId: string, day: string) {
    return cells.filter(
      (c) => c.axisId === axisId && String(c.workDate).slice(0, 10) === day,
    );
  }

  async function saveCell() {
    if (!editor?.personId) return;
    const person = people.find((p) => p.globalPersonId === editor.personId);
    const res = await fetch(`/api/duty-schedules/${dept.toLowerCase()}/week`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekStart,
        workDate: editor.day,
        axisId: editor.axisId,
        globalPersonId: editor.personId,
        shiftCode: editor.shiftCode || "E",
        personName: person?.name,
        orgUnitId: person?.orgUnitId ?? null,
        orgUnitName: person?.orgUnitName ?? null,
        positionId: person?.positionId ?? null,
        positionName: person?.positionName ?? null,
      }),
    });
    if (!res.ok) showApiError(await res.json(), title);
    else setEditor(null);
    await load();
  }

  async function removeCell(cellId: string) {
    const res = await fetch(`/api/duty-schedules/${dept.toLowerCase()}/week`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteCell", cellId }),
    });
    if (!res.ok) showApiError(await res.json(), title);
    await load();
  }

  async function setStatusAction(next: "DRAFT" | "APPROVED") {
    const msg =
      next === "APPROVED" ? t("confirmApprove") : t("confirmReopen");
    if (!window.confirm(msg)) return;
    const res = await fetch(`/api/duty-schedules/${dept.toLowerCase()}/week`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setStatus", weekStart, status: next }),
    });
    if (!res.ok) showApiError(await res.json(), title);
    await load();
  }

  async function copyPrev(replace: boolean) {
    if (!window.confirm(replace ? t("confirmCopyReplace") : t("confirmCopy"))) {
      return;
    }
    const res = await fetch(`/api/duty-schedules/${dept.toLowerCase()}/week`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "copyPreviousWeek",
        weekStart,
        replace,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      if (json?.code === "COPY_TARGET_NOT_EMPTY" && !replace) {
        await copyPrev(true);
        return;
      }
      showApiError(json, title);
      return;
    }
    await load();
  }

  async function saveBindingUnits(ids: string[]) {
    const res = await fetch(
      `/api/duty-schedules/${dept.toLowerCase()}/binding`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgUnitIds: ids }),
      },
    );
    if (!res.ok) showApiError(await res.json(), title);
    await load();
  }

  async function saveAxis() {
    if (!axisDraftCode.trim() || !axisDraftName.trim()) return;
    const res = await fetch(`/api/duty-schedules/${dept.toLowerCase()}/axes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: axisDraftCode.trim(),
        name: axisDraftName.trim(),
      }),
    });
    if (!res.ok) showApiError(await res.json(), title);
    else {
      setAxisDraftCode("");
      setAxisDraftName("");
    }
    await load();
  }

  const personOptions = people.map((p) => ({
    value: p.globalPersonId,
    label: p.positionName ? `${p.name} (${p.positionName})` : p.name,
  }));

  const shiftOptions = shiftCodes.map((c) => ({
    value: c.code,
    label: c.startTime
      ? `${c.code} ${c.startTime}–${c.endTime}`
      : `${c.code} · ${c.label}`,
  }));

  const readOnly = status === "APPROVED";
  const emptyBinding = orgUnitIds.length === 0 && !unavailable;

  return (
    <div className="space-y-3">
      <PageHeader
        title={title}
        subtitle={`${subtitle} · ${weekLabel}`}
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <span
              className={
                status === "APPROVED"
                  ? "text-xs font-medium rounded-full px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "text-xs font-medium rounded-full px-2 py-1 bg-amber-50 text-amber-900 border border-amber-200"
              }
            >
              {status === "APPROVED" ? t("approved") : t("draft")}
            </span>
            {status === "DRAFT" ? (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => void setStatusAction("APPROVED")}
              >
                {t("approve")}
              </button>
            ) : (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => void setStatusAction("DRAFT")}
              >
                {t("reopenDraft")}
              </button>
            )}
            {!readOnly ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => void copyPrev(false)}
              >
                {t("copyPrevWeek")}
              </button>
            ) : null}
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setSettingsOpen((o) => !o)}
            >
              {settingsOpen ? t("hideSettings") : t("showSettings")}
            </button>
          </div>
        }
      />

      <EraListFilterBar
        resetLabel={tc("filterReset")}
        onReset={() => {
          setWeekStart(mondayOf(today));
          setSelectedUnit("");
        }}
      >
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => setWeekStart(addHotelDays(weekStart, -7))}
        >
          {t("prevWeek")}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => setWeekStart(mondayOf(today))}
        >
          {t("thisWeek")}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => setWeekStart(addHotelDays(weekStart, 7))}
        >
          {t("nextWeek")}
        </button>
        <DatePicker
          label={t("weekStart")}
          value={weekStart}
          placeholder={tc("datePlaceholder")}
          onChange={(v) => setWeekStart(mondayOf(v || today))}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("orgUnitFilter")}
          value={selectedUnit}
          onChange={(v) => setSelectedUnit(String(v ?? ""))}
          options={[
            { value: "", label: t("allBoundUnits") },
            ...filterUnitOptions,
          ]}
        />
      </EraListFilterBar>

      {unavailable ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          {t("workforceUnavailable")}
        </p>
      ) : null}

      {!settingsOpen && emptyBinding ? (
        <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex flex-wrap gap-2 items-center justify-between">
          <span>{t("emptyBindingHint")}</span>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => setSettingsOpen(true)}
          >
            {t("showSettings")}
          </button>
        </p>
      ) : null}

      {settingsOpen ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <CatalogField
              kind="MULTI"
              label={t("boundOrgUnits")}
              value={orgUnitIds}
              onChange={(v) => {
                const next = Array.isArray(v) ? v.map(String) : [];
                setOrgUnitIds(next);
              }}
              options={
                filterUnitOptions.length
                  ? filterUnitOptions
                  : orgUnitIds.map((id) => ({ value: id, label: id }))
              }
            />
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => void saveBindingUnits(orgUnitIds)}
              disabled={unavailable}
            >
              {t("saveBinding")}
            </button>
          </div>
          <p className="text-xs text-slate-500">{t("bindingHint")}</p>
          <div className="flex flex-wrap gap-2 items-end">
            <span className="text-xs font-medium text-slate-700 self-end pb-2">
              {t("axesTitle")}
            </span>
            {axes.map((a) => (
              <span
                key={a.id}
                className="text-xs rounded-md border border-slate-200 bg-slate-50 px-2 py-1"
              >
                {a.name}{" "}
                <span className="text-slate-400">{a.code}</span>
              </span>
            ))}
            {!readOnly ? (
              <>
                <label className="text-xs text-slate-600">
                  {t("axisCode")}
                  <input
                    className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    value={axisDraftCode}
                    onChange={(e) => setAxisDraftCode(e.target.value)}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  {t("axisName")}
                  <input
                    className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm min-w-[10rem]"
                    value={axisDraftName}
                    onChange={(e) => setAxisDraftName(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => void saveAxis()}
                >
                  {t("saveAxis")}
                </button>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs items-center">
            <span className="text-slate-500">{t("legend")}:</span>
            {shiftCodes.map((c) => (
              <span
                key={c.code}
                className={`inline-flex items-center rounded-md border px-1.5 py-0.5 ${shiftChipClass(c.code)}`}
              >
                {c.code}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {editor && !readOnly ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-3 flex flex-wrap gap-2 items-end">
          <CatalogField
            kind="SEARCHABLE"
            label={t("person")}
            value={editor.personId}
            onChange={(v) =>
              setEditor((prev) =>
                prev ? { ...prev, personId: String(v ?? "") } : prev,
              )
            }
            options={personOptions}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("shift")}
            value={editor.shiftCode}
            onChange={(v) =>
              setEditor((prev) =>
                prev ? { ...prev, shiftCode: String(v ?? "E") } : prev,
              )
            }
            options={shiftOptions}
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => void saveCell()}
            disabled={!editor.personId || unavailable}
          >
            {tc("save")}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => setEditor(null)}
          >
            {tc("cancel")}
          </button>
        </div>
      ) : null}

      <div className={DATA_TABLE_SHELL_CLASS}>
        <div className="overflow-x-auto">
          <table className={`${DATA_TABLE_CLASS} min-w-[920px]`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th
                  className={`${DATA_TABLE_TH_LEFT_CLASS} sticky left-0 z-10 bg-white`}
                >
                  {t("axis")}
                </th>
                {days.map((d) => (
                  <th
                    key={d}
                    className={`${DATA_TABLE_TH_LEFT_CLASS} ${dayHeaderClass(d, today)}`}
                  >
                    {bakuDateShort(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {axes.map((axis) => (
                <tr key={axis.id} className={DATA_TABLE_TR_CLASS}>
                  <td
                    className={`${DATA_TABLE_TD_CLASS} sticky left-0 z-10 bg-white`}
                  >
                    <div className="font-medium">{axis.name}</div>
                    <div className="text-xs text-slate-500">{axis.code}</div>
                  </td>
                  {days.map((day) => {
                    const list = cellsFor(axis.id, day);
                    const isEditing =
                      editor?.axisId === axis.id && editor.day === day;
                    return (
                      <td
                        key={day}
                        className={`${DATA_TABLE_TD_CLASS} align-top min-w-[8.5rem] ${dayHeaderClass(day, today)}`}
                      >
                        <ul className="space-y-1 mb-1">
                          {list.map((c) => (
                            <li key={c.id}>
                              <span
                                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs ${shiftChipClass(c.shiftCode, c.orphaned)}`}
                              >
                                <span className="font-semibold">
                                  {c.shiftCode}
                                </span>
                                <span className="truncate max-w-[6rem]">
                                  {c.personName}
                                </span>
                                {c.orphaned ? (
                                  <span className="opacity-80">
                                    · {t("orphaned")}
                                  </span>
                                ) : null}
                                {!readOnly ? (
                                  <button
                                    type="button"
                                    className="ml-0.5 underline opacity-70 hover:opacity-100"
                                    onClick={() => void removeCell(c.id)}
                                  >
                                    ×
                                  </button>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {!readOnly && !unavailable ? (
                          <button
                            type="button"
                            className={
                              isEditing
                                ? "text-xs text-sky-800 underline"
                                : "text-xs text-slate-500 hover:text-slate-800 underline"
                            }
                            onClick={() =>
                              setEditor({
                                axisId: axis.id,
                                day,
                                personId: "",
                                shiftCode: "E",
                              })
                            }
                          >
                            {t("addAssignment")}
                          </button>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {axes.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={8}>
                    <div className="flex flex-wrap gap-2 items-center justify-between">
                      <span>{t("noAxes")}</span>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => setSettingsOpen(true)}
                      >
                        {t("showSettings")}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
              {!unavailable &&
              people.length === 0 &&
              axes.length > 0 &&
              cells.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={8}>
                    {t("emptyPeople")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
