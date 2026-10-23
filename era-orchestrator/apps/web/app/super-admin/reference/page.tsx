"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CatalogField, CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { cpAdminFetch } from "../../../lib/cp-admin-fetch";

const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "RUB", "TRY", "CNY", "JPY"].map((code) => ({
  value: code,
  label: code,
}));

type Policy = { catalogKind: string; externalFetchEnabled: boolean };
type PolicyPayload = {
  policies: Policy[];
  fxDashboardCurrencyCodes: string[];
  fxCbarCheckCurrencyCodes: string[];
};
type OrgRow = {
  id: string;
  name: string;
  publicOrgNumber: number;
  referenceSource: "hub" | "excel";
};

export default function SuperAdminReferencePage() {
  const t = useTranslations("superAdmin.reference");
  const [policy, setPolicy] = useState<PolicyPayload | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyOrg, setBusyOrg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [policyRes, orgRes] = await Promise.all([
        cpAdminFetch("reference/policy"),
        cpAdminFetch("reference/orgs"),
      ]);
      if (!policyRes.ok) {
        setError(t("loadFailed"));
      } else {
        setPolicy((await policyRes.json()) as PolicyPayload);
      }
      if (orgRes.ok) {
        const body = (await orgRes.json()) as { orgs: OrgRow[] };
        setOrgs(body.orgs ?? []);
      }
    })();
  }, [t]);

  function toggle(kind: string) {
    setPolicy((current) => {
      if (!current) return current;
      return {
        ...current,
        policies: current.policies.map((row) =>
          row.catalogKind === kind
            ? { ...row, externalFetchEnabled: !row.externalFetchEnabled }
            : row,
        ),
      };
    });
  }

  async function savePolicy() {
    if (!policy) return;
    setSaving(true);
    setNotice(null);
    setError(null);
    const res = await cpAdminFetch("reference/policy", {
      method: "PATCH",
      body: JSON.stringify(policy),
    });
    setSaving(false);
    if (!res.ok) {
      setError(t("saveFailed"));
      return;
    }
    setPolicy((await res.json()) as PolicyPayload);
    setNotice(t("saved"));
  }

  async function setSource(org: OrgRow, referenceSource: "hub" | "excel") {
    setBusyOrg(org.id);
    setError(null);
    const res = await cpAdminFetch(`reference/orgs/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ referenceSource }),
    });
    setBusyOrg(null);
    if (!res.ok) {
      setError(t("saveFailed"));
      return;
    }
    setOrgs((rows) => rows.map((row) => (row.id === org.id ? { ...row, referenceSource } : row)));
    setNotice(t("saved"));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#34495E]">{t("title")}</h1>
        <p className="mt-1 text-sm text-[#7F8C8D]">{t("subtitle")}</p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="text-sm font-semibold text-[#34495E]">{t("fetchHeading")}</h2>
        <ul className="space-y-2">
          {(policy?.policies ?? []).map((row) => (
            <li key={row.catalogKind} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-[#34495E]">{row.catalogKind}</span>
              <input
                type="checkbox"
                checked={row.externalFetchEnabled}
                onChange={() => toggle(row.catalogKind)}
                aria-label={row.catalogKind}
              />
            </li>
          ))}
        </ul>
        {policy ? (
          <>
            <CatalogField
              kind="MULTI"
              label={t("codesHeading")}
              value={policy.fxDashboardCurrencyCodes}
              options={CURRENCY_OPTIONS}
              onChange={(next) =>
                setPolicy({
                  ...policy,
                  fxDashboardCurrencyCodes: Array.isArray(next) ? next : [next],
                })
              }
            />
            <CatalogField
              kind="MULTI"
              label={t("checkHeading")}
              value={policy.fxCbarCheckCurrencyCodes}
              options={CURRENCY_OPTIONS}
              onChange={(next) =>
                setPolicy({
                  ...policy,
                  fxCbarCheckCurrencyCodes: Array.isArray(next) ? next : [next],
                })
              }
            />
          </>
        ) : null}
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={saving || !policy} onClick={() => void savePolicy()}>
          {saving ? t("saving") : t("savePolicy")}
        </button>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t("orgsHeading")}</h2>
        <ul className="space-y-2">
          {orgs.map((org) => (
            <li key={org.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {org.name}{" "}
                <span className="text-[#95A5A6]">#{org.publicOrgNumber}</span>
              </span>
              <CatalogField
                kind="CLOSED_SMALL"
                label={org.name}
                value={org.referenceSource}
                options={[
                  { value: "hub", label: t("sourceHub") },
                  { value: "excel", label: t("sourceExcel") },
                ]}
                disabled={busyOrg === org.id}
                onChange={(next) => {
                  const value = Array.isArray(next) ? next[0] : next;
                  if (value === "hub" || value === "excel") void setSource(org, value);
                }}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
