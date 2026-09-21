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
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

type PlaceRow = { id: string; code: string; name: string; status: string };
type DeviceRow = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  placeId: string;
  lastSeenAt: string | null;
  hmacSecretHash: string | null;
  place?: { id: string; code: string; name: string };
};
type IdentityRow = {
  id: string;
  personRef: string;
  employmentId: string;
  employment?: {
    id: string;
    globalPersonId: string;
    orgUnit?: { name: string } | null;
    position?: { name: string } | null;
  };
};
type PunchRow = {
  id: string;
  personRef: string;
  direction: string;
  status: string;
  occurredAt: string;
  placeMismatch: boolean;
  place?: { code: string; name: string };
  device?: { name: string };
};
type EmpOpt = { id: string; globalPersonId: string };
type PersonProfile = { displayName: string | null };

function staffCodeFromEmployment(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export default function WorkforceAttendancePage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceAttendance");
  const tCommon = useTranslations("common");

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [identities, setIdentities] = useState<IdentityRow[]>([]);
  const [punches, setPunches] = useState<PunchRow[]>([]);
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [emps, setEmps] = useState<EmpOpt[]>([]);
  const [persons, setPersons] = useState<Record<string, PersonProfile>>({});
  const [usePlannedIfOpen, setUsePlannedIfOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [punchFilter, setPunchFilter] = useState("UNMAPPED");

  const [deviceModal, setDeviceModal] = useState(false);
  const [devName, setDevName] = useState("");
  const [devPlaceId, setDevPlaceId] = useState("");
  const [devHmac, setDevHmac] = useState(false);
  const [shownToken, setShownToken] = useState<string | null>(null);

  const [idModal, setIdModal] = useState(false);
  const [personRef, setPersonRef] = useState("");
  const [employmentId, setEmploymentId] = useState("");

  const [rebuildFrom, setRebuildFrom] = useState("");
  const [rebuildTo, setRebuildTo] = useState("");
  const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);

  const [csvDeviceId, setCsvDeviceId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [csvMsg, setCsvMsg] = useState<string | null>(null);
  const [xlsxBase64, setXlsxBase64] = useState<string | null>(null);

  const empOptions = useMemo(
    () =>
      emps.map((e) => {
        const name =
          persons[e.globalPersonId]?.displayName ??
          e.globalPersonId.slice(0, 8);
        const code = staffCodeFromEmployment(e.id);
        return {
          value: e.id,
          label: `${name} (${code})`,
        };
      }),
    [emps, persons],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = punchFilter ? `?status=${punchFilter}&limit=100` : "?limit=100";
    const [devRes, idRes, punchRes, placeRes, empRes] = await Promise.all([
      wfFetch("attendance/devices"),
      wfFetch("attendance/identities"),
      wfFetch(`attendance/punches${qs}`),
      wfFetch("places?status=ACTIVE"),
      wfFetch("employments?pageSize=200"),
    ]);
    if (await isWorkforceGate403(devRes)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (!devRes.ok || !idRes.ok || !punchRes.ok) {
      setError(t("loadError"));
      setLoading(false);
      return;
    }
    setDevices(await devRes.json());
    setIdentities(await idRes.json());
    setPunches(await punchRes.json());
    if (placeRes.ok) {
      const p = await placeRes.json();
      setPlaces(Array.isArray(p) ? p : p.items ?? []);
    }
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

  async function createDevice() {
    if (!devName.trim() || !devPlaceId) return;
    setBusy(true);
    const res = await wfFetch("attendance/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: devName.trim(),
        placeId: devPlaceId,
        requireHmac: devHmac,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(t("saveError"));
      return;
    }
    const created = await res.json();
    setShownToken(created.token ?? null);
    setDeviceModal(false);
    setDevName("");
    setDevPlaceId("");
    setDevHmac(false);
    await load();
  }

  async function revokeDevice(id: string) {
    setBusy(true);
    await wfFetch(`attendance/devices/${id}/revoke`, { method: "POST" });
    setBusy(false);
    await load();
  }

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
        ...(xlsxBase64
          ? { xlsxBase64 }
          : { csv: csvText }),
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
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {error ? <p className="text-sm text-[var(--era-danger)]">{error}</p> : null}
      {shownToken ? (
        <div className={`${CARD_CONTAINER_CLASS} space-y-2`}>
          <p className="text-sm font-medium">{t("tokenOnce")}</p>
          <code className="block break-all text-xs">{shownToken}</code>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => setShownToken(null)}
          >
            {tCommon("close")}
          </button>
        </div>
      ) : null}

      <section className={CARD_CONTAINER_CLASS}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t("devicesTitle")}</h2>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => setDeviceModal(true)}
          >
            {t("addDevice")}
          </button>
        </div>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colName")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPlace")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colHmac")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{d.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {d.place?.name ?? d.placeId}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{d.status}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {d.hmacSecretHash ? t("hmacOn") : t("hmacOff")}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {d.status === "ACTIVE" ? (
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy}
                        onClick={() => void revokeDevice(d.id)}
                      >
                        {t("revoke")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!loading && devices.length === 0 ? (
                <tr>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={5}>
                    {t("emptyDevices")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className={CARD_CONTAINER_CLASS}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t("identitiesTitle")}</h2>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => setIdModal(true)}
          >
            {t("addIdentity")}
          </button>
        </div>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPersonRef")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colEmployment")}</th>
              </tr>
            </thead>
            <tbody>
              {identities.map((row) => (
                <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{row.personRef}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.employment?.position?.name ?? row.employmentId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={CARD_CONTAINER_CLASS}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t("punchesTitle")}</h2>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("punchFilter")}
            value={punchFilter}
            onChange={(v) => setPunchFilter(String(v))}
            options={[
              { value: "UNMAPPED", label: "UNMAPPED" },
              { value: "OPEN", label: "OPEN" },
              { value: "MAPPED", label: "MAPPED" },
              { value: "PAIRED", label: "PAIRED" },
            ]}
          />
        </div>
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
                    {new Date(p.occurredAt).toLocaleString()}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{p.personRef}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{p.direction}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {p.status}
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

      <section className={`${CARD_CONTAINER_CLASS} space-y-3`}>
        <h2 className="text-base font-semibold">{t("rebuildTitle")}</h2>
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
          <label className="text-sm">
            {t("from")}
            <input
              type="date"
              className="ml-2 rounded border px-2 py-1"
              value={rebuildFrom}
              onChange={(e) => setRebuildFrom(e.target.value)}
            />
          </label>
          <label className="text-sm">
            {t("to")}
            <input
              type="date"
              className="ml-2 rounded border px-2 py-1"
              value={rebuildTo}
              onChange={(e) => setRebuildTo(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !rebuildFrom || !rebuildTo}
            onClick={() => void runRebuild()}
          >
            {t("rebuild")}
          </button>
        </div>
        {rebuildMsg ? <p className="text-sm">{rebuildMsg}</p> : null}
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3`}>
        <h2 className="text-base font-semibold">{t("csvTitle")}</h2>
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
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={busy || !csvDeviceId || (!csvText.trim() && !xlsxBase64)}
          onClick={() => void runCsv()}
        >
          {t("csvImport")}
        </button>
        {csvMsg ? <p className="text-sm">{csvMsg}</p> : null}
      </section>

      {deviceModal ? (
        <ModalShell
          title={t("addDevice")}
          onClose={() => setDeviceModal(false)}
        >
          <div className="space-y-3">
            <label className="block text-sm">
              {t("colName")}
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={devName}
                onChange={(e) => setDevName(e.target.value)}
              />
            </label>
            <CatalogField
              kind="ENTITY_REF"
              label={t("colPlace")}
              value={devPlaceId}
              onChange={(v) => setDevPlaceId(String(v))}
              options={places.map((p) => ({
                value: p.id,
                label: `${p.code} — ${p.name}`,
              }))}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={devHmac}
                onChange={(e) => setDevHmac(e.target.checked)}
              />
              {t("requireHmac")}
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setDeviceModal(false)}
              >
                {tCommon("cancel")}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void createDevice()}
              >
                {tCommon("save")}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

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
    </div>
  );
}
