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
  ModalFooter,
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
      <PageHeader
        title={t("identitiesTitle")}
        subtitle={t("subtitle")}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => {
              setPersonRef("");
              setEmploymentId("");
              setIdModal(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {t("addIdentity")}
          </button>
        }
      />
      <WorkforceAttendanceSubnav />
      {error ? <p className="text-sm text-[var(--era-danger)]">{error}</p> : null}

      <section className={CARD_CONTAINER_CLASS}>
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
                    {empOptions.find((o) => o.value === row.employmentId)?.label ??
                      row.employment?.position?.name ??
                      row.employmentId}
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
          open
          title={t("addIdentity")}
          onClose={() => setIdModal(false)}
          closeLabel={tCommon("close")}
          footer={
            <ModalFooter
              onCancel={() => setIdModal(false)}
              onSubmit={() => void saveIdentity()}
              busy={busy}
              submitDisabled={!personRef.trim() || !employmentId}
              cancelLabel={tCommon("cancel")}
              submitLabel={tCommon("save")}
            />
          }
        >
          <div className="grid gap-3">
            <CatalogField
              kind="FREE_TEXT"
              label={t("colPersonRef")}
              value={personRef}
              onChange={(v) => setPersonRef(String(v))}
              options={[]}
            />
            <CatalogField
              kind="ENTITY_REF"
              label={t("colEmployment")}
              value={employmentId}
              onChange={(v) => setEmploymentId(String(v))}
              options={empOptions}
              emptyLabel={tCommon("select")}
            />
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
