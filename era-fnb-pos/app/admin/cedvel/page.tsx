"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { bakuDateShort, todayBakuYmd } from "@era/satellite-kit/time";
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

type Cell = {
  id: string;
  workDate: string;
  globalPersonId: string;
  personName: string;
  positionName?: string | null;
  outletName?: string | null;
  outletId?: string | null;
  shiftCode: string;
  orphaned?: boolean;
};

type Person = {
  globalPersonId: string;
  name: string;
  orgUnitId: string | null;
  orgUnitName: string | null;
  positionId: string | null;
  positionName: string | null;
};

type ShiftCode = {
  code: string;
  label: string;
  startTime: string | null;
  endTime: string | null;
};

type Outlet = { id: string; name: string; code: string };

function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mondayOf(day: string) {
  const dow = new Date(`${day}T12:00:00.000Z`).getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(day, diff);
}

export default function FnbCedvelPage() {
  const t = useTranslations("cedvel");
  const tc = useTranslations("common");
  const today = todayBakuYmd();
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [status, setStatus] = useState<"DRAFT" | "APPROVED">("DRAFT");
  const [cells, setCells] = useState<Cell[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [shiftCodes, setShiftCodes] = useState<ShiftCode[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [orgUnitIds, setOrgUnitIds] = useState<string[]>([]);
  const [orgUnitOptions, setOrgUnitOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [outletFilter, setOutletFilter] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [active, setActive] = useState<{
    personId: string;
    day: string;
  } | null>(null);
  const [pickCode, setPickCode] = useState("E");
  const [pickOutlet, setPickOutlet] = useState("");

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const weekLabel = useMemo(
    () => `${bakuDateShort(days[0]!)} – ${bakuDateShort(days[6]!)}`,
    [days],
  );

  const load = useCallback(async () => {
    const qs = selectedUnit
      ? `?orgUnitId=${encodeURIComponent(selectedUnit)}`
      : "";
    // Week first so ensureFnbDutyDefaults seeds before personnel (avoids parallel upsert races).
    const weekRes = await fetch(
      `/api/admin/cedvel/week?weekStart=${weekStart}`,
    );
    const weekJson = await weekRes.json();
    if (!weekRes.ok) {
      showApiError(weekJson, t("title"));
      return;
    }
    const peopleRes = await fetch(`/api/admin/cedvel/personnel${qs}`);
    const peopleJson = await peopleRes.json();
    if (!peopleRes.ok) {
      showApiError(peopleJson, t("title"));
      return;
    }
    setStatus(weekJson.week?.status === "APPROVED" ? "APPROVED" : "DRAFT");
    setCells(Array.isArray(weekJson.week?.cells) ? weekJson.week.cells : []);
    setShiftCodes(Array.isArray(weekJson.shiftCodes) ? weekJson.shiftCodes : []);
    setOutlets(Array.isArray(weekJson.outlets) ? weekJson.outlets : []);
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
  }, [weekStart, selectedUnit, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const peopleRows = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        positionName?: string | null;
        outletName?: string | null;
      }
    >();
    for (const p of people) {
      map.set(p.globalPersonId, {
        id: p.globalPersonId,
        name: p.name,
        positionName: p.positionName,
      });
    }
    for (const c of cells) {
      if (outletFilter && c.outletId && c.outletId !== outletFilter) continue;
      if (outletFilter && !c.outletId) continue;
      if (!map.has(c.globalPersonId)) {
        map.set(c.globalPersonId, {
          id: c.globalPersonId,
          name: c.personName,
          positionName: c.positionName,
          outletName: c.outletName,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [cells, people, outletFilter]);

  const unitOptions = useMemo(() => {
    const map = new Map(orgUnitOptions.map((o) => [o.value, o.label]));
    for (const id of orgUnitIds) if (!map.has(id)) map.set(id, id);
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [orgUnitOptions, orgUnitIds]);

  function cellFor(personId: string, day: string) {
    return cells.find(
      (c) =>
        c.globalPersonId === personId &&
        String(c.workDate).slice(0, 10) === day &&
        (!outletFilter || c.outletId === outletFilter),
    );
  }

  async function upsertFor(personId: string, day: string, shiftCode: string) {
    const person = people.find((p) => p.globalPersonId === personId);
    const outlet = outlets.find((o) => o.id === pickOutlet);
    const res = await fetch("/api/admin/cedvel/week", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekStart,
        workDate: day,
        globalPersonId: personId,
        shiftCode,
        personName: person?.name,
        positionName: person?.positionName ?? null,
        orgUnitId: person?.orgUnitId ?? null,
        orgUnitName: person?.orgUnitName ?? null,
        positionId: person?.positionId ?? null,
        outletId: pickOutlet || null,
        outletName: outlet?.name ?? null,
      }),
    });
    if (!res.ok) showApiError(await res.json(), t("title"));
    else setActive(null);
    await load();
  }

  async function removeCell(cellId: string) {
    const res = await fetch("/api/admin/cedvel/week", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteCell", cellId }),
    });
    if (!res.ok) showApiError(await res.json(), t("title"));
    await load();
  }

  async function setStatusAction(next: "DRAFT" | "APPROVED") {
    const msg =
      next === "APPROVED" ? t("confirmApprove") : t("confirmReopen");
    if (!window.confirm(msg)) return;
    const res = await fetch("/api/admin/cedvel/week", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setStatus", weekStart, status: next }),
    });
    if (!res.ok) showApiError(await res.json(), t("title"));
    await load();
  }

  async function copyPrev(replace: boolean) {
    if (!window.confirm(replace ? t("confirmCopyReplace") : t("confirmCopy"))) {
      return;
    }
    const res = await fetch("/api/admin/cedvel/week", {
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
      showApiError(json, t("title"));
      return;
    }
    await load();
  }

  async function saveBinding() {
    const res = await fetch("/api/admin/cedvel/binding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgUnitIds }),
    });
    if (!res.ok) showApiError(await res.json(), t("title"));
    await load();
  }

  const readOnly = status === "APPROVED";
  const emptyBinding = orgUnitIds.length === 0 && !unavailable;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
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
                {t("reopen")}
              </button>
            )}
          </div>
        }
      />

      <EraListFilterBar>
        <div className="flex flex-wrap gap-2 items-end">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => setWeekStart(addDays(weekStart, -7))}
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
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            {t("nextWeek")}
          </button>
          <DatePicker
            label={t("weekStart")}
            value={weekStart}
            placeholder={tc("datePlaceholder")}
            onChange={(v) => setWeekStart(mondayOf(v || today))}
          />
          <span className="text-sm font-medium text-slate-700 self-end pb-2">
            {weekLabel}
          </span>
        </div>
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("orgUnitFilter")}
          value={selectedUnit}
          onChange={(v) => setSelectedUnit(String(v ?? ""))}
          options={[
            { value: "", label: t("allUnits") },
            ...unitOptions,
          ]}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("outletFilter")}
          value={outletFilter}
          onChange={(v) => setOutletFilter(String(v ?? ""))}
          options={[
            { value: "", label: t("allOutlets") },
            ...outlets.map((o) => ({ value: o.id, label: o.name })),
          ]}
        />
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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">
            {t("settingsTitle")}
          </h3>
          <div className="flex flex-wrap gap-2 items-end">
            <CatalogField
              kind="MULTI"
              label={t("boundUnits")}
              value={orgUnitIds}
              onChange={(v) =>
                setOrgUnitIds(Array.isArray(v) ? v.map(String) : [])
              }
              options={unitOptions}
            />
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={unavailable}
              onClick={() => void saveBinding()}
            >
              {t("saveBinding")}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-slate-500 self-center">{t("legend")}:</span>
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

      {active && !readOnly ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-3 flex flex-wrap gap-2 items-end">
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("shift")}
            value={pickCode}
            onChange={(v) => setPickCode(String(v ?? "E"))}
            options={shiftCodes.map((c) => ({
              value: c.code,
              label: c.startTime
                ? `${c.code} ${c.startTime}–${c.endTime}`
                : `${c.code} · ${c.label}`,
            }))}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("outlet")}
            value={pickOutlet}
            onChange={(v) => setPickOutlet(String(v ?? ""))}
            options={[
              { value: "", label: "—" },
              ...outlets.map((o) => ({ value: o.id, label: o.name })),
            ]}
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={unavailable}
            onClick={() =>
              void upsertFor(active.personId, active.day, pickCode)
            }
          >
            {tc("save")}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => setActive(null)}
          >
            {tc("cancel")}
          </button>
        </div>
      ) : null}

      <div className={DATA_TABLE_SHELL_CLASS}>
        <div className="overflow-x-auto">
          <table className={`${DATA_TABLE_CLASS} min-w-[960px]`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th
                  className={`${DATA_TABLE_TH_LEFT_CLASS} sticky left-0 z-10 bg-white`}
                >
                  {t("person")}
                </th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("position")}</th>
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
              {peopleRows.map((row) => (
                <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                  <td
                    className={`${DATA_TABLE_TD_CLASS} sticky left-0 z-10 bg-white font-medium`}
                  >
                    {row.name}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.positionName ?? "—"}
                  </td>
                  {days.map((day) => {
                    const cell = cellFor(row.id, day);
                    const isActive =
                      active?.personId === row.id && active.day === day;
                    return (
                      <td
                        key={day}
                        className={`${DATA_TABLE_TD_CLASS} ${dayHeaderClass(day, today)}`}
                      >
                        {cell ? (
                          <button
                            type="button"
                            disabled={readOnly || unavailable}
                            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs ${shiftChipClass(cell.shiftCode, cell.orphaned)} ${isActive ? "ring-2 ring-sky-400" : ""}`}
                            onClick={() => {
                              if (readOnly || unavailable) return;
                              setPickCode(cell.shiftCode);
                              setPickOutlet(cell.outletId ?? "");
                              setActive({ personId: row.id, day });
                            }}
                          >
                            <span className="font-semibold">
                              {cell.shiftCode}
                            </span>
                            {cell.orphaned ? (
                              <span>· {t("orphaned")}</span>
                            ) : null}
                            {!readOnly ? (
                              <span
                                role="button"
                                className="ml-0.5 underline opacity-70"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void removeCell(cell.id);
                                }}
                              >
                                ×
                              </span>
                            ) : null}
                          </button>
                        ) : !readOnly && !unavailable ? (
                          <button
                            type="button"
                            className={`text-xs text-slate-400 hover:text-slate-700 underline ${isActive ? "text-sky-800" : ""}`}
                            onClick={() => {
                              setPickCode("E");
                              setPickOutlet("");
                              setActive({ personId: row.id, day });
                            }}
                          >
                            {t("setShift")}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {peopleRows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={10}>
                    {t("empty")}
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
