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
import { useRequireAuth } from "../../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../../components/workspace/workforce-gate";
import { WorkforceAttendanceSubnav } from "../../../../../components/workspace/workforce-attendance-subnav";
import {
  staffCodeFromEmployment,
  type EmpOpt,
  type IdentityRow,
  type PersonProfile,
} from "../_lib/types";

export default function WorkforceAttendanceIdentitiesPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceAttendance");
  const tCommon = useTranslations("common");

  const [identities, setIdentities] = useState<IdentityRow[]>([]);
  const [emps, setEmps] = useState<EmpOpt[]>([]);
  const [persons, setPersons] = useState<Record<string, PersonProfile>>({});
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [idModal, setIdModal] = useState(false);
  const [personRef, setPersonRef] = useState("");
  const [employmentId, setEmploymentId] = useState("");

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
    const [idRes, empRes] = await Promise.all([
      wfFetch("attendance/identities"),
      wfFetch("employments?pageSize=200"),
    ]);
    if (await isWorkforceGate403(idRes)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (!idRes.ok) {
      setError(t("loadError"));
      setLoading(false);
      return;
    }
    setIdentities(await idRes.json());
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
  }, [t]);

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

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("identitiesTitle")} subtitle={t("subtitle")} />
      <WorkforceAttendanceSubnav />
      {error ? <p className="text-sm text-[var(--era-danger)]">{error}</p> : null}

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
              {!loading && identities.length === 0 ? (
                <tr>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={2}>
                    —
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
    </div>
  );
}
