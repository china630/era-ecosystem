"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  CatalogField,
  catalogKindForOptions,
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  DatePicker,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { bakuYmd, todayBakuYmd } from "@era/satellite-kit/time";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  parseOrgUnitItems,
  parseWorkforceApiError,
  workforceFetch as wfFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

type Place = { id: string; code: string; name: string; status: string };
type Cycle = { id: string; code: string; name: string };
type Brigade = { id: string; code: string; name: string };
type Employment = {
  id: string;
  staffCode: string | null;
  status: string;
  globalPersonId?: string;
  orgUnitId?: string | null;
  orgUnit?: { id: string; name: string } | null;
};
type PreviewCell = {
  day: number;
  type: "WORK" | "OFF" | null;
  hours: number;
  placeId: string | null;
  placeCode: string | null;
  shiftTypeCode: string | null;
  fromOverride: boolean;
  conflict?: boolean;
  conflictPlaces?: string[];
};

type CoverageGap = {
  placeId: string;
  placeCode: string;
  placeName: string;
  days: number[];
};

type PreviewRow = {
  employmentId: string;
  staffCode: string | null;
  orgUnitId: string | null;
  globalPersonId: string | null;
  cells: PreviewCell[];
};

type PersonBrief = {
  displayName?: string | null;
  accessDenied?: boolean;
};

async function loadActiveEmployments(): Promise<{
  items: Employment[];
  persons: Record<string, PersonBrief>;
}> {
  const items: Employment[] = [];
  const persons: Record<string, PersonBrief> = {};
  for (let page = 1; page <= 30; page++) {
    const res = await wfFetch(
      `employments?status=ACTIVE&pageSize=100&page=${page}`,
    );
    if (!res.ok) break;
    const body = (await res.json()) as {
      items?: Employment[];
      total?: number;
      persons?: Record<string, PersonBrief>;
    };
    const chunk = Array.isArray(body) ? (body as Employment[]) : (body.items ?? []);
    items.push(...chunk);
    if (!Array.isArray(body) && body.persons) Object.assign(persons, body.persons);
    const total = !Array.isArray(body) && typeof body.total === "number" ? body.total : items.length;
    if (chunk.length === 0 || items.length >= total) break;
  }
  return { items, persons };
}

function asRows<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { items?: T[] }).items)) {
    return (raw as { items: T[] }).items;
  }
  return [];
}

function placeColor(code: string | null | undefined): string {
  if (!code) return "#ECF0F1";
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 42% 88%)`;
}

export default function WorkforceRosterPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceRoster");
  const tCommon = useTranslations("common");

  const anchorYear = bakuYmd().y;
  const [year, setYear] = useState(anchorYear);
  const [month, setMonth] = useState(() => bakuYmd().m);
  const [filterPlaceId, setFilterPlaceId] = useState("");
  const [filterOrgUnitId, setFilterOrgUnitId] = useState("");

  const [places, setPlaces] = useState<Place[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [brigades, setBrigades] = useState<Brigade[]>([]);
  const [employments, setEmployments] = useState<Employment[]>([]);
  const [persons, setPersons] = useState<Record<string, PersonBrief>>({});
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [gaps, setGaps] = useState<CoverageGap[]>([]);
  const [lastDay, setLastDay] = useState(31);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editAssignmentId, setEditAssignmentId] = useState<string | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [targetKind, setTargetKind] = useState<"employment" | "brigade">(
    "employment",
  );
  const [formPlaceId, setFormPlaceId] = useState("");
  const [formCycleId, setFormCycleId] = useState("");
  const [formEmploymentId, setFormEmploymentId] = useState("");
  const [formBrigadeId, setFormBrigadeId] = useState("");
  const [formFrom, setFormFrom] = useState(() => todayBakuYmd());
  const [formTo, setFormTo] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [ovEmploymentId, setOvEmploymentId] = useState("");
  const [ovDay, setOvDay] = useState(1);
  const [ovKind, setOvKind] = useState("DAY_OFF");
  const [ovPlaceId, setOvPlaceId] = useState("");
  const [ovShiftTypeId, setOvShiftTypeId] = useState("");
  const [shiftTypes, setShiftTypes] = useState<
    Array<{ id: string; code: string; name: string }>
  >([]);

  const loadPreview = useCallback(async () => {
    const qs = new URLSearchParams({
      year: String(year),
      month: String(month),
    });
    if (filterPlaceId) qs.set("placeId", filterPlaceId);
    if (filterOrgUnitId) qs.set("orgUnitId", filterOrgUnitId);
    const res = await wfFetch(`roster/preview?${qs}`);
    if (!res.ok) return;
    const body = (await res.json()) as {
      lastDay: number;
      rows: PreviewRow[];
      gaps?: CoverageGap[];
      persons?: Record<string, PersonBrief>;
    };
    setLastDay(body.lastDay);
    setPreviewRows(body.rows ?? []);
    setGaps(body.gaps ?? []);
    if (body.persons) {
      setPersons((prev) => ({ ...prev, ...body.persons }));
    }
  }, [year, month, filterPlaceId, filterOrgUnitId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [pRes, cRes, bRes, eRes, uRes, tRes] = await Promise.all([
      wfFetch("places?status=ACTIVE"),
      wfFetch("shift-cycles"),
      wfFetch("brigades"),
      loadActiveEmployments(),
      wfFetch("org-units"),
      wfFetch("shift-types"),
    ]);
    if (await isWorkforceGate403(pRes)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (pRes.ok) setPlaces(asRows<Place>(await pRes.json()));
    if (cRes.ok) setCycles(asRows<Cycle>(await cRes.json()));
    if (bRes.ok) setBrigades(asRows<Brigade>(await bRes.json()));
    if (tRes.ok) setShiftTypes(asRows(await tRes.json()));
    setEmployments(eRes.items);
    if (eRes.persons) {
      setPersons((prev) => ({ ...prev, ...eRes.persons }));
    }
    if (uRes.ok) {
      setUnits(parseOrgUnitItems(await uRes.json()));
    }
    if (!pRes.ok) setError(t("loadError"));
    await loadPreview();
    setLoading(false);
  }, [t, loadPreview]);

  useEffect(() => {
    if (year < anchorYear - 1 || year > anchorYear + 1) {
      const n = bakuYmd();
      setYear(n.y);
      setMonth(n.m);
    }
  }, [year, anchorYear]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  useEffect(() => {
    if (ready && !loading) void loadPreview();
  }, [ready, loading, loadPreview]);

  async function createAssignment() {
    if (!formPlaceId || !formCycleId || !formFrom) {
      setFormError(t("requiredFields"));
      return;
    }
    if (formTo && formTo < formFrom) {
      setFormError(t("assignmentRange"));
      return;
    }
    if (!editAssignmentId) {
      if (targetKind === "employment" && !formEmploymentId) {
        setFormError(t("requiredFields"));
        return;
      }
      if (targetKind === "brigade" && !formBrigadeId) {
        setFormError(t("requiredFields"));
        return;
      }
    }
    setBusy(true);
    setFormError(null);
    const body: Record<string, unknown> = {
      placeId: formPlaceId,
      cycleId: formCycleId,
      effectiveFrom: formFrom,
      effectiveTo: formTo || null,
    };
    if (!editAssignmentId) {
      if (targetKind === "employment") body.employmentId = formEmploymentId;
      else body.brigadeId = formBrigadeId;
    }
    const path = editAssignmentId
      ? `shift-assignments/${editAssignmentId}`
      : "shift-assignments";
    const res = await wfFetch(path, {
      method: editAssignmentId ? "PATCH" : "POST",
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const err = await parseWorkforceApiError(res);
      setFormError(
        err.code === "ASSIGNMENT_OVERLAP"
          ? t("assignmentOverlap")
          : err.code === "ASSIGNMENT_RANGE"
            ? t("assignmentRange")
            : err.message || t("saveError"),
      );
      return;
    }
    setAssignOpen(false);
    setEditAssignmentId(null);
    await load();
    await loadPreview();
  }

  async function saveOverride() {
    if (!ovEmploymentId || !ovDay) {
      setFormError(t("requiredFields"));
      return;
    }
    if (
      (ovKind === "EXTRA" || ovKind === "SWAP") &&
      (!ovShiftTypeId || !ovPlaceId)
    ) {
      setFormError(t("overridePlaceHint"));
      return;
    }
    const workDate = `${year}-${String(month).padStart(2, "0")}-${String(ovDay).padStart(2, "0")}`;
    setBusy(true);
    setFormError(null);
    const res = await wfFetch("day-overrides", {
      method: "PUT",
      body: JSON.stringify({
        employmentId: ovEmploymentId,
        workDate,
        kind: ovKind,
        placeId: ovPlaceId || null,
        shiftTypeId: ovShiftTypeId || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const err = await parseWorkforceApiError(res);
      setFormError(err.message || t("saveError"));
      return;
    }
    setOverrideOpen(false);
    await loadPreview();
  }

  function openCellOverride(row: PreviewRow, cell: PreviewCell) {
    setOvEmploymentId(row.employmentId);
    setOvDay(cell.day);
    setOvKind(cell.type === "WORK" ? "DAY_OFF" : "EXTRA");
    setOvPlaceId(cell.placeId ?? filterPlaceId ?? "");
    setOvShiftTypeId(
      shiftTypes.find((s) => s.code === cell.shiftTypeCode)?.id ?? "",
    );
    setFormError(null);
    setOverrideOpen(true);
  }

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  const placeOptions = places.map((p) => ({
    value: p.id,
    label: `${p.code} — ${p.name}`,
  }));
  const cycleOptions = cycles.map((c) => ({
    value: c.id,
    label: `${c.code} — ${c.name}`,
  }));
  const empLabel = (empId: string, extraPersonId?: string | null) => {
    const row = previewRows.find((r) => r.employmentId === empId);
    const emp = employments.find((e) => e.id === empId);
    const personId =
      extraPersonId || row?.globalPersonId || emp?.globalPersonId || "";
    const person = personId ? persons[personId] : undefined;
    const name = person?.displayName?.trim();
    if (name) return name;
    if (person?.accessDenied) return t("maskedPerson");
    return tCommon("unnamedPerson");
  };
  const empOptions = employments.map((e) => ({
    value: e.id,
    label: empLabel(e.id),
  }));
  const brigadeOptions = brigades.map((b) => ({
    value: b.id,
    label: `${b.code} — ${b.name}`,
  }));
  const unitOptions = units.map((u) => ({ value: u.id, label: u.name }));
  const shiftTypeOptions = shiftTypes.map((s) => ({
    value: s.id,
    label: `${s.code} — ${s.name}`,
  }));
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }));
  const yearOptions = [anchorYear - 1, anchorYear, anchorYear + 1].map((y) => ({
    value: String(y),
    label: String(y),
  }));
  const dayOptions = Array.from({ length: lastDay }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }));
  const kindOptions = [
    { value: "DAY_OFF", label: t("overrideDayOff") },
    { value: "EXTRA", label: t("overrideExtra") },
    { value: "SWAP", label: t("overrideSwap") },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("rosterTitle")}
        subtitle={t("rosterHint")}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => {
                setOvEmploymentId(employments[0]?.id ?? "");
                setOvDay(1);
                setOvKind("DAY_OFF");
                setOvPlaceId("");
                setOvShiftTypeId("");
                setFormError(null);
                setOverrideOpen(true);
              }}
            >
              {t("addOverride")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                setEditAssignmentId(null);
                setFormPlaceId("");
                setFormCycleId("");
                setFormEmploymentId("");
                setFormBrigadeId("");
                setFormFrom(todayBakuYmd());
                setFormTo("");
                setFormError(null);
                setTargetKind("brigade");
                setAssignOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t("addAssignment")}
            </button>
          </div>
        }
      />

      <EraListFilterBar
        resetLabel={tCommon("filterReset")}
        onReset={() => {
          const n = bakuYmd();
          setYear(n.y);
          setMonth(n.m);
          setFilterPlaceId("");
          setFilterOrgUnitId("");
        }}
      >
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("year")}
          value={String(year)}
          onChange={(v) => setYear(Number(v))}
          options={yearOptions}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("month")}
          value={String(month)}
          onChange={(v) => setMonth(Number(v))}
          options={monthOptions}
        />
        <CatalogField
          kind={catalogKindForOptions(placeOptions.length)}
          label={t("filterPlace")}
          value={filterPlaceId}
          onChange={(v) => setFilterPlaceId(String(v))}
          options={placeOptions}
          emptyLabel={t("allPlaces")}
        />
        <CatalogField
          kind={catalogKindForOptions(unitOptions.length)}
          label={t("filterOrgUnit")}
          value={filterOrgUnitId}
          onChange={(v) => setFilterOrgUnitId(String(v))}
          options={unitOptions}
          emptyLabel={t("allUnits")}
        />
      </EraListFilterBar>

      <div className={CARD_CONTAINER_CLASS}>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <>
            {gaps.length > 0 ? (
              <div className="mb-4">
                <h2 className="mb-1 text-sm font-semibold">{t("gapsHeading")}</h2>
                <ul className="space-y-1 text-sm text-[#7F8C8D]">
                  {gaps.map((gap) => (
                    <li key={gap.placeId}>
                      <span className="font-medium text-[#34495E]">
                        {gap.placeCode} — {gap.placeName}
                      </span>
                      {": "}
                      {gap.days.join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <h2 className="mb-2 text-sm font-semibold">{t("gridHeading")}</h2>
            <p className="mb-2 text-xs text-[var(--era-muted)]">{t("gridHint")}</p>
            <div className={`${DATA_TABLE_VIEWPORT_CLASS} mb-6 overflow-x-auto`}>
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colTarget")}</th>
                    {Array.from({ length: lastDay }, (_, i) => (
                      <th key={i + 1} className={DATA_TABLE_TH_LEFT_CLASS}>
                        {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr className={DATA_TABLE_TR_CLASS}>
                      <td
                        className={`${DATA_TABLE_TD_CLASS} py-8 text-center text-[#7F8C8D]`}
                        colSpan={lastDay + 1}
                      >
                        {tCommon("loading")}
                      </td>
                    </tr>
                  ) : previewRows.length === 0 ? (
                    <tr className={DATA_TABLE_TR_CLASS}>
                      <td
                        className={`${DATA_TABLE_TD_CLASS} py-8 text-center text-[#7F8C8D]`}
                        colSpan={lastDay + 1}
                      >
                        {t("rosterEmpty")}
                      </td>
                    </tr>
                  ) : (
                  previewRows.map((row) => (
                    <tr key={row.employmentId} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {empLabel(row.employmentId)}
                      </td>
                      {row.cells.map((cell) => {
                        const base =
                          cell.type == null
                            ? "·"
                            : cell.type === "OFF"
                              ? t("slotOff")
                              : cell.shiftTypeCode ?? "W";
                        const label = cell.conflict ? `${base}!` : base;
                        return (
                          <td key={cell.day} className={DATA_TABLE_TD_CLASS} style={{ padding: 2 }}>
                            <button
                              type="button"
                              title={
                                cell.conflict
                                  ? t("conflictTitle", {
                                      places: (cell.conflictPlaces ?? []).join(", "),
                                    })
                                  : `${cell.placeCode ?? ""} ${cell.shiftTypeCode ?? cell.type ?? ""}`.trim()
                              }
                              className="min-w-[1.75rem] rounded px-1 py-0.5 text-[10px] leading-tight"
                              style={{
                                background:
                                  cell.type === "WORK"
                                    ? placeColor(cell.placeCode)
                                    : cell.type === "OFF"
                                      ? "#F5F6F7"
                                      : "transparent",
                                outline: cell.conflict
                                  ? "2px solid #C0392B"
                                  : cell.fromOverride
                                    ? "1px solid #E67E22"
                                    : undefined,
                              }}
                              onClick={() => openCellOverride(row, cell)}
                            >
                              {label}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                  )}
                </tbody>
              </table>
            </div>
        </>
      </div>

      <ModalShell
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={editAssignmentId ? t("editAssignment") : t("addAssignment")}
        closeLabel={tCommon("close")}
        footer={
          <ModalFooter
            onCancel={() => setAssignOpen(false)}
            onSubmit={() => void createAssignment()}
            busy={busy}
            cancelLabel={tCommon("cancel")}
            submitLabel={tCommon("save")}
          />
        }
      >
        <div className="space-y-3">
          {editAssignmentId ? null : (
            <>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("targetKind")}
            value={targetKind}
            onChange={(v) =>
              setTargetKind(v === "brigade" ? "brigade" : "employment")
            }
            options={[
              { value: "employment", label: t("employment") },
              { value: "brigade", label: t("brigade") },
            ]}
          />
          {targetKind === "employment" ? (
            <CatalogField
              kind="ENTITY_REF"
              label={t("employment")}
              value={formEmploymentId}
              onChange={(v) => setFormEmploymentId(String(v))}
              options={empOptions}
              emptyLabel={tCommon("select")}
            />
          ) : (
            <CatalogField
              kind={catalogKindForOptions(brigadeOptions.length)}
              label={t("brigade")}
              value={formBrigadeId}
              onChange={(v) => setFormBrigadeId(String(v))}
              options={brigadeOptions}
              emptyLabel={tCommon("select")}
            />
          )}
            </>
          )}
          <CatalogField
            kind={catalogKindForOptions(placeOptions.length)}
            label={t("colPlace")}
            value={formPlaceId}
            onChange={(v) => setFormPlaceId(String(v))}
            options={placeOptions}
            emptyLabel={tCommon("select")}
          />
          <CatalogField
            kind={catalogKindForOptions(cycleOptions.length)}
            label={t("colCycle")}
            value={formCycleId}
            onChange={(v) => setFormCycleId(String(v))}
            options={cycleOptions}
            emptyLabel={tCommon("select")}
          />
          <DatePicker
            label={t("colFrom")}
            value={formFrom}
            onChange={setFormFrom}
            placeholder={tCommon("datePlaceholder")}
            fluid
          />
          <DatePicker
            label={t("colTo")}
            value={formTo}
            onChange={setFormTo}
            placeholder={tCommon("datePlaceholder")}
            fluid
          />
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
      </ModalShell>

      <ModalShell
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        title={t("addOverride")}
        closeLabel={tCommon("close")}
        footer={
          <ModalFooter
            onCancel={() => setOverrideOpen(false)}
            onSubmit={() => void saveOverride()}
            busy={busy}
            cancelLabel={tCommon("cancel")}
            submitLabel={tCommon("save")}
          />
        }
      >
        <div className="space-y-3">
          <CatalogField
            kind="ENTITY_REF"
            label={t("employment")}
            value={ovEmploymentId}
            onChange={(v) => setOvEmploymentId(String(v))}
            options={empOptions}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("colDay")}
            value={String(ovDay)}
            onChange={(v) => setOvDay(Number(v))}
            options={dayOptions}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("overrideKind")}
            value={ovKind}
            onChange={(v) => setOvKind(String(v))}
            options={kindOptions}
          />
          {(ovKind === "EXTRA" || ovKind === "SWAP") && (
            <>
              <CatalogField
                kind="ENTITY_REF"
                label={t("colPlace")}
                value={ovPlaceId}
                onChange={(v) => setOvPlaceId(String(v))}
                options={placeOptions}
              />
              <p className="text-xs text-[#7F8C8D]">{t("overridePlaceHint")}</p>
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("colShiftType")}
                value={ovShiftTypeId}
                onChange={(v) => setOvShiftTypeId(String(v))}
                options={shiftTypeOptions}
              />
            </>
          )}
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
      </ModalShell>

    </div>
  );
}
