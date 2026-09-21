"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  CatalogField,
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  parseOrgUnitItems,
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
  orgUnitId?: string | null;
  orgUnit?: { id: string; name: string } | null;
};
type Assignment = {
  id: string;
  placeId: string;
  cycleId: string;
  employmentId: string | null;
  brigadeId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  place?: Place;
  cycle?: Cycle;
  employment?: Employment | null;
  brigade?: Brigade | null;
};

type PreviewCell = {
  day: number;
  type: "WORK" | "OFF" | null;
  hours: number;
  placeId: string | null;
  placeCode: string | null;
  shiftTypeCode: string | null;
  fromOverride: boolean;
};

type PreviewRow = {
  employmentId: string;
  staffCode: string | null;
  orgUnitId: string | null;
  cells: PreviewCell[];
};

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

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [preserveManual, setPreserveManual] = useState(false);
  const [filterPlaceId, setFilterPlaceId] = useState("");
  const [filterOrgUnitId, setFilterOrgUnitId] = useState("");

  const [places, setPlaces] = useState<Place[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [brigades, setBrigades] = useState<Brigade[]>([]);
  const [employments, setEmployments] = useState<Employment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [lastDay, setLastDay] = useState(31);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [materializeMsg, setMaterializeMsg] = useState<string | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [targetKind, setTargetKind] = useState<"employment" | "brigade">(
    "employment",
  );
  const [formPlaceId, setFormPlaceId] = useState("");
  const [formCycleId, setFormCycleId] = useState("");
  const [formEmploymentId, setFormEmploymentId] = useState("");
  const [formBrigadeId, setFormBrigadeId] = useState("");
  const [formFrom, setFormFrom] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
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
    };
    setLastDay(body.lastDay);
    setPreviewRows(body.rows ?? []);
  }, [year, month, filterPlaceId, filterOrgUnitId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [pRes, cRes, bRes, aRes, eRes, uRes, tRes] = await Promise.all([
      wfFetch("places?status=ACTIVE"),
      wfFetch("shift-cycles"),
      wfFetch("brigades"),
      wfFetch("shift-assignments"),
      wfFetch("employments?status=ACTIVE&pageSize=200"),
      wfFetch("org-units"),
      wfFetch("shift-types"),
    ]);
    if (await isWorkforceGate403(pRes)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (pRes.ok) setPlaces(await pRes.json());
    if (cRes.ok) setCycles(await cRes.json());
    if (bRes.ok) setBrigades(await bRes.json());
    if (aRes.ok) setAssignments(await aRes.json());
    if (tRes.ok) setShiftTypes(await tRes.json());
    if (eRes.ok) {
      const body = await eRes.json();
      const items = Array.isArray(body) ? body : (body.items ?? []);
      setEmployments(items);
    }
    if (uRes.ok) {
      setUnits(parseOrgUnitItems(await uRes.json()));
    }
    if (!pRes.ok || !aRes.ok) setError(t("loadError"));
    await loadPreview();
    setLoading(false);
  }, [t, loadPreview]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  useEffect(() => {
    if (ready && !loading) void loadPreview();
  }, [ready, loading, loadPreview]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (filterPlaceId && a.placeId !== filterPlaceId) return false;
      if (filterOrgUnitId) {
        const empOu =
          a.employment?.orgUnitId ?? a.employment?.orgUnit?.id ?? null;
        if (a.employmentId && empOu && empOu !== filterOrgUnitId) return false;
      }
      return true;
    });
  }, [assignments, filterPlaceId, filterOrgUnitId]);

  async function createAssignment() {
    if (!formPlaceId || !formCycleId || !formFrom) {
      setFormError(t("requiredFields"));
      return;
    }
    if (targetKind === "employment" && !formEmploymentId) {
      setFormError(t("requiredFields"));
      return;
    }
    if (targetKind === "brigade" && !formBrigadeId) {
      setFormError(t("requiredFields"));
      return;
    }
    setBusy(true);
    setFormError(null);
    const body: Record<string, unknown> = {
      placeId: formPlaceId,
      cycleId: formCycleId,
      effectiveFrom: formFrom,
      effectiveTo: formTo || null,
    };
    if (targetKind === "employment") body.employmentId = formEmploymentId;
    else body.brigadeId = formBrigadeId;
    const res = await wfFetch("shift-assignments", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(t("saveError"));
      return;
    }
    setAssignOpen(false);
    await load();
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
      setFormError(t("saveError"));
      return;
    }
    setOverrideOpen(false);
    await loadPreview();
  }

  async function materialize() {
    setBusy(true);
    setMaterializeMsg(null);
    setError(null);
    const monthRes = await wfFetch(
      `timesheets?year=${year}&month=${month}&pageSize=1`,
    );
    if (!monthRes.ok) {
      setBusy(false);
      setError(t("materializeError"));
      return;
    }
    const sheet = await monthRes.json();
    const id = sheet.id as string;
    const qs = preserveManual ? "?preserveManual=true" : "";
    const res = await wfFetch(`timesheets/${id}/materialize-roster${qs}`, {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    if (!res.ok) {
      setError(t("materializeError"));
      return;
    }
    const summary = await res.json();
    setMaterializeMsg(
      t("materializeOk", {
        touched: summary.cellsTouched ?? 0,
        locked: summary.cellsSkippedLocked ?? 0,
        manual: summary.cellsSkippedManual ?? 0,
      }),
    );
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
  const empOptions = employments.map((e) => ({
    value: e.id,
    label: e.staffCode ?? e.id.slice(0, 8),
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
  const yearOptions = [year - 1, year, year + 1].map((y) => ({
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
                setFormPlaceId(places[0]?.id ?? "");
                setFormCycleId(cycles[0]?.id ?? "");
                setFormEmploymentId("");
                setFormBrigadeId("");
                setFormError(null);
                setAssignOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t("addAssignment")}
            </button>
          </div>
        }
      />

      <div className={CARD_CONTAINER_CLASS}>
        <div className="mb-4 flex flex-wrap items-end gap-3">
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
            kind="CLOSED_SMALL"
            label={t("preserveManual")}
            value={preserveManual ? "yes" : "no"}
            onChange={(v) => setPreserveManual(v === "yes")}
            options={[
              { value: "no", label: t("preserveNo") },
              { value: "yes", label: t("preserveYes") },
            ]}
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => void materialize()}
          >
            {t("materialize")}
          </button>
        </div>
        {materializeMsg ? (
          <p className="mb-3 text-sm text-[var(--era-muted)]">{materializeMsg}</p>
        ) : null}
        <div className="mb-3 flex flex-wrap gap-3">
          <CatalogField
            kind="ENTITY_REF"
            label={t("filterPlace")}
            value={filterPlaceId}
            onChange={(v) => setFilterPlaceId(String(v))}
            options={[{ value: "", label: t("allPlaces") }, ...placeOptions]}
          />
          <CatalogField
            kind="ENTITY_REF"
            label={t("filterOrgUnit")}
            value={filterOrgUnitId}
            onChange={(v) => setFilterOrgUnitId(String(v))}
            options={[{ value: "", label: t("allUnits") }, ...unitOptions]}
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-[var(--era-muted)]">{tCommon("loading")}</p>
        ) : (
          <>
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
                  {previewRows.map((row) => (
                    <tr key={row.employmentId} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.staffCode ?? row.employmentId.slice(0, 8)}
                      </td>
                      {row.cells.map((cell) => {
                        const label =
                          cell.type == null
                            ? "·"
                            : cell.type === "OFF"
                              ? "Off"
                              : cell.shiftTypeCode ?? "W";
                        return (
                          <td key={cell.day} className={DATA_TABLE_TD_CLASS} style={{ padding: 2 }}>
                            <button
                              type="button"
                              title={`${cell.placeCode ?? ""} ${cell.shiftTypeCode ?? cell.type ?? ""}`.trim()}
                              className="min-w-[1.75rem] rounded px-1 py-0.5 text-[10px] leading-tight"
                              style={{
                                background:
                                  cell.type === "WORK"
                                    ? placeColor(cell.placeCode)
                                    : cell.type === "OFF"
                                      ? "#F5F6F7"
                                      : "transparent",
                                outline: cell.fromOverride
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
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="mb-2 text-sm font-semibold">{t("assignmentsHeading")}</h2>
            <div className={DATA_TABLE_VIEWPORT_CLASS}>
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colTarget")}</th>
                    <th
                      className={DATA_TABLE_TH_LEFT_CLASS}
                      title={t("colPlaceTitle")}
                    >
                      {t("colPlace")}
                    </th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCycle")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colFrom")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colTo")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map((row) => (
                    <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.employmentId
                          ? row.employment?.staffCode ??
                            row.employmentId.slice(0, 8)
                          : row.brigade
                            ? `${row.brigade.code} (${t("brigade")})`
                            : "—"}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.place
                          ? `${row.place.code} — ${row.place.name}`
                          : row.placeId.slice(0, 8)}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.cycle?.code ?? row.cycleId.slice(0, 8)}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {String(row.effectiveFrom).slice(0, 10)}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.effectiveTo
                          ? String(row.effectiveTo).slice(0, 10)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <ModalShell
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={t("addAssignment")}
      >
        <div className="space-y-3">
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
            />
          ) : (
            <CatalogField
              kind="ENTITY_REF"
              label={t("brigade")}
              value={formBrigadeId}
              onChange={(v) => setFormBrigadeId(String(v))}
              options={brigadeOptions}
            />
          )}
          <CatalogField
            kind="ENTITY_REF"
            label={t("colPlace")}
            value={formPlaceId}
            onChange={(v) => setFormPlaceId(String(v))}
            options={placeOptions}
          />
          <CatalogField
            kind="ENTITY_REF"
            label={t("colCycle")}
            value={formCycleId}
            onChange={(v) => setFormCycleId(String(v))}
            options={cycleOptions}
          />
          <CatalogField
            kind="FREE_TEXT"
            label={t("colFrom")}
            value={formFrom}
            onChange={(v) => setFormFrom(String(v))}
            options={[]}
          />
          <CatalogField
            kind="FREE_TEXT"
            label={t("colTo")}
            value={formTo}
            onChange={(v) => setFormTo(String(v))}
            options={[]}
          />
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setAssignOpen(false)}
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void createAssignment()}
            >
              {tCommon("save")}
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        title={t("addOverride")}
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
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setOverrideOpen(false)}
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void saveOverride()}
            >
              {tCommon("save")}
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
