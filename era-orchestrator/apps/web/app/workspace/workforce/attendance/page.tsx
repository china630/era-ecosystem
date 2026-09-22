"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  ModalFooter,
  ModalShell,
  DatePicker,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { bakuDateTimeDisplay } from "@era/satellite-kit/time";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";
import { WorkforceAttendanceSubnav } from "../../../../components/workspace/workforce-attendance-subnav";
import {
  staffCodeFromEmployment,
  type DeviceRow,
  type EmpOpt,
  type PersonProfile,
  type PunchRow,
} from "./_lib/types";

export default function WorkforceAttendancePunchesPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceAttendance");
  const tCommon = useTranslations("common");

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [punches, setPunches] = useState<PunchRow[]>([]);
  const [emps, setEmps] = useState<EmpOpt[]>([]);
  const [persons, setPersons] = useState<Record<string, PersonProfile>>({});
  const [usePlannedIfOpen, setUsePlannedIfOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [punchFilter, setPunchFilter] = useState("UNMAPPED");

  const [idModal, setIdModal] = useState(false);
  const [personRef, setPersonRef] = useState("");
  const [employmentId, setEmploymentId] = useState("");

  const [rebuildFrom, setRebuildFrom] = useState("");
  const [rebuildTo, setRebuildTo] = useState("");
  const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);
  const [rebuildOpen, setRebuildOpen] = useState(false);

  const [csvDeviceId, setCsvDeviceId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [csvMsg, setCsvMsg] = useState<string | null>(null);
  const [xlsxBase64, setXlsxBase64] = useState<string | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);

  const empOptions = useMemo(
    () =>
      emps.map((e) => {
        const name =
          persons[e.globalPersonId]?.displayName ?? tCommon("unnamedPerson");
        const code = staffCodeFromEmployment(e.id);
        return {
          value: e.id,
          label: `${name} (${code})`,
        };
      }),
    [emps, persons, tCommon],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = punchFilter ? `?status=${punchFilter}&limit=100` : "?limit=100";
    const [devRes, punchRes, empRes] = await Promise.all([
      wfFetch("attendance/devices"),
      wfFetch(`attendance/punches${qs}`),
      wfFetch("employments?pageSize=200"),
    ]);
    if (await isWorkforceGate403(punchRes)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (!punchRes.ok) {
      setError(t("loadError"));
      setLoading(false);
      return;
    }
    setPunches(await punchRes.json());
    if (devRes.ok) setDevices(await devRes.json());
    if (empRes.ok) {
      const e = await empRes.json();
      const items = Array.isArray(e) ? e : e.items ?? e.employments ?? [];
      setEmps(
        items.map((x: EmpOpt) => ({
          id: x.id,
          globalPersonId: x.globalPersonId,
        })),
      );
      if (!Array.isArray(e) && e.persons) {
        setPersons(e.persons);
      }
    }
    setLoading(false);
  }, [punchFilter, t]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  async function saveIdentity() {
    if (!personRef.trim() || !employmentId) return;
    setBusy(true);
    const res = await wfFetch("attendance/identities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personRef: personRef.trim(), employmentId }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(t("saveError"));
      return;
    }
    setIdModal(false);
    setPersonRef("");
    setEmploymentId("");
    await load();
  }

  async function runRebuild() {
    if (!rebuildFrom || !rebuildTo) return;
    setBusy(true);
    setRebuildMsg(null);
    const res = await wfFetch("attendance/rebuild", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: rebuildFrom,
        to: rebuildTo,
        usePlannedIfOpen,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setRebuildMsg(t("rebuildError"));
      return;
    }
    const s = await res.json();
    setRebuildMsg(
      t("rebuildOk", {
        pairs: s.pairsWritten,
        cells: s.cellsUpserted,
        open: s.openLeft,
        skipped: s.cellsSkippedApproved + s.cellsSkippedAbsence,
      }),
    );
    await load();
  }

  async function runCsv() {
    if (!csvDeviceId || (!csvText.trim() && !xlsxBase64)) return;
    setBusy(true);
    setCsvMsg(null);
    const res = await wfFetch("attendance/import-csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: csvDeviceId,
        ...(xlsxBase64 ? { xlsxBase64 } : { csv: csvText }),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setCsvMsg(t("csvError"));
      return;
    }
    const s = await res.json();
    setCsvMsg(
      t("csvOk", {
        accepted: s.accepted,
        rejected: s.rejected,
        duplicates: s.duplicates,
      }),
    );
    setXlsxBase64(null);
    await load();
  }

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => {
                setRebuildMsg(null);
                setRebuildOpen(true);
              }}
            >
              {t("rebuildTitle")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => {
                setCsvMsg(null);
                setCsvOpen(true);
              }}
            >
              {t("csvTitle")}
            </button>
          </div>
        }
      />
      <WorkforceAttendanceSubnav />
      {error ? <p className="text-sm text-[var(--era-danger)]">{error}</p> : null}

      <EraListFilterBar
        className="mb-3"
        resetLabel={tCommon("filterReset")}
        onReset={() => setPunchFilter("UNMAPPED")}
      >
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("punchFilter")}
          value={punchFilter}
          onChange={(v) => setPunchFilter(String(v))}
          options={[
            { value: "UNMAPPED", label: t("statusUnmapped") },
            { value: "OPEN", label: t("statusOpen") },
            { value: "MAPPED", label: t("statusMapped") },
            { value: "PAIRED", label: t("statusPaired") },
          ]}
          emptyLabel={t("filterAll")}
        />
      </EraListFilterBar>
      <section className={CARD_CONTAINER_CLASS}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colWhen")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPersonRef")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colDirection")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPlace")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
              </tr>
            </thead>
            <tbody>
              {punches.map((p) => (
                <tr key={p.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {bakuDateTimeDisplay(p.occurredAt)}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{p.personRef}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{p.direction}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {p.status === "UNMAPPED"
                      ? t("statusUnmapped")
                      : p.status === "OPEN"
                        ? t("statusOpen")
                        : p.status === "MAPPED"
                          ? t("statusMapped")
                          : p.status === "PAIRED"
                            ? t("statusPaired")
                            : p.status}
                    {p.placeMismatch ? ` · ${t("placeMismatch")}` : ""}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {p.place?.name ?? "—"}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {p.status === "UNMAPPED" ? (
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => {
                          setPersonRef(p.personRef);
                          setIdModal(true);
                        }}
                      >
                        {t("mapPerson")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!loading && punches.length === 0 ? (
                <tr>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={6}>
                    {t("emptyPunches")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {idModal ? (
        <ModalShell
          title={t("addIdentity")}
          onClose={() => setIdModal(false)}
        >
          <div className="space-y-3">
            <label className="block text-sm">
              {t("colPersonRef")}
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={personRef}
                onChange={(e) => setPersonRef(e.target.value)}
              />
            </label>
            <CatalogField
              kind="ENTITY_REF"
              label={t("colEmployment")}
              value={employmentId}
              onChange={(v) => setEmploymentId(String(v))}
              options={empOptions}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setIdModal(false)}
              >
                {tCommon("cancel")}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void saveIdentity()}
              >
                {tCommon("save")}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      <ModalShell
        open={rebuildOpen}
        title={t("rebuildTitle")}
        onClose={() => setRebuildOpen(false)}
        closeLabel={tCommon("close")}
        footer={
          <ModalFooter
            onCancel={() => setRebuildOpen(false)}
            onSubmit={() => void runRebuild()}
            cancelLabel={tCommon("cancel")}
            submitLabel={t("rebuild")}
            busy={busy}
            submitDisabled={!rebuildFrom || !rebuildTo}
          />
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--era-muted)]">{t("rebuildHint")}</p>
          <label className="flex items-start gap-2 text-sm text-[#34495E]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={usePlannedIfOpen}
              onChange={(e) => setUsePlannedIfOpen(e.target.checked)}
            />
            <span>
              {t("usePlannedIfOpen")}
              <span className="mt-0.5 block text-xs text-[var(--era-muted)]">
                {t("usePlannedIfOpenHint")}
              </span>
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            <DatePicker
              label={t("from")}
              value={rebuildFrom}
              onChange={setRebuildFrom}
              placeholder={tCommon("datePlaceholder")}
              fluid
            />
            <DatePicker
              label={t("to")}
              value={rebuildTo}
              onChange={setRebuildTo}
              placeholder={tCommon("datePlaceholder")}
              fluid
            />
          </div>
          {rebuildMsg ? <p className="text-sm">{rebuildMsg}</p> : null}
        </div>
      </ModalShell>

      <ModalShell
        open={csvOpen}
        title={t("csvTitle")}
        onClose={() => setCsvOpen(false)}
        closeLabel={tCommon("close")}
        maxWidthClass="max-w-xl"
        footer={
          <ModalFooter
            onCancel={() => setCsvOpen(false)}
            onSubmit={() => void runCsv()}
            cancelLabel={tCommon("cancel")}
            submitLabel={t("csvImport")}
            busy={busy}
            submitDisabled={!csvDeviceId || (!csvText.trim() && !xlsxBase64)}
          />
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--era-muted)]">{t("csvHint")}</p>
          <CatalogField
            kind="ENTITY_REF"
            label={t("csvDevice")}
            value={csvDeviceId}
            onChange={(v) => setCsvDeviceId(String(v))}
            options={devices
              .filter((d) => d.status === "ACTIVE")
              .map((d) => ({ value: d.id, label: d.name }))}
          />
          <textarea
            className="min-h-[120px] w-full rounded border p-2 font-mono text-xs"
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setXlsxBase64(null);
            }}
            placeholder="occurredAt,direction,personRef,externalId"
          />
          <label className="block text-sm">
            {t("xlsxFile")}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="mt-1 block text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) {
                  setXlsxBase64(null);
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  const result = String(reader.result ?? "");
                  const b64 = result.includes(",")
                    ? result.split(",")[1]!
                    : result;
                  setXlsxBase64(b64);
                  setCsvText("");
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
          {csvMsg ? <p className="text-sm">{csvMsg}</p> : null}
        </div>
      </ModalShell>
    </div>
  );
}
