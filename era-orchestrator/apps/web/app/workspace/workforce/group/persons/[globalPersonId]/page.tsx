"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../../../../../lib/auth-context";
import {
  buildFinanceHandoffUrl,
  ensureFreshOrchAccessToken,
} from "../../../../../../lib/open-finance";
import { useRequireAuth } from "../../../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  parseWorkforceApiError,
  workforceFetch as wfFetch,
} from "../../../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../../../components/workspace/workforce-gate";

type EmpBlock = {
  organizationId: string;
  orgName: string;
  employmentId: string;
  status: string;
  hireDate: string;
  orgUnit?: { name: string } | null;
  position?: { name: string } | null;
};

type VisibleOrg = { organizationId: string; organizationName: string };

type PersonProfile = {
  displayName?: string | null;
  finMasked?: string | null;
  accessDenied?: boolean;
};

export default function WorkforceGroupPersonPage() {
  const { ready } = useRequireAuth();
  const { switchOrganization, memberships, user } = useAuth();
  const t = useTranslations("workforceGroup");
  const tCommon = useTranslations("common");
  const params = useParams();
  const search = useSearchParams();
  const globalPersonId = String(params.globalPersonId ?? "");
  const holdingId = search.get("holdingId") ?? "";

  const [person, setPerson] = useState<PersonProfile | null>(null);
  const [employments, setEmployments] = useState<EmpBlock[]>([]);
  const [visibleOrgs, setVisibleOrgs] = useState<VisibleOrg[]>([]);
  const [hireOrgId, setHireOrgId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function formatStatus(code: string): string {
    if (code === "ACTIVE") return t("statusActive");
    if (code === "TERMINATED") return t("statusTerminated");
    return code;
  }

  const load = useCallback(async () => {
    if (!globalPersonId) {
      setLoading(false);
      setError(t("missingPerson"));
      return;
    }
    setLoading(true);
    setError(null);
    const qs = holdingId
      ? `?holdingId=${encodeURIComponent(holdingId)}`
      : "";
    const res = await wfFetch(
      `persons/${encodeURIComponent(globalPersonId)}/employments${qs}`,
    );
    if (await isWorkforceGate403(res)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (!res.ok) {
      const err = await parseWorkforceApiError(res);
      if (err.code === "HOLDING_HR_FORBIDDEN") setError(t("forbidden"));
      else if (err.code === "HOLDING_HR_NO_STANDALONE") setError(t("noStandalone"));
      else if (err.status === 404) setError(t("holdingNotFound"));
      else setError(err.message || t("loadError"));
      setLoading(false);
      return;
    }
    const body = await res.json();
    setPerson(body.person ?? null);
    setEmployments(body.employments ?? []);
    setVisibleOrgs(body.visibleOrgs ?? []);
    const missing = (body.visibleOrgs as VisibleOrg[] | undefined)?.find(
      (o) =>
        !(body.employments as EmpBlock[] | undefined)?.some(
          (e) => e.organizationId === o.organizationId && e.status === "ACTIVE",
        ),
    );
    if (missing) setHireOrgId(missing.organizationId);
    setLoading(false);
  }, [holdingId, globalPersonId, t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const hireOptions = useMemo(() => {
    const employed = new Set(
      employments
        .filter((e) => e.status === "ACTIVE")
        .map((e) => e.organizationId),
    );
    return visibleOrgs
      .filter((o) => !employed.has(o.organizationId))
      .map((o) => ({ value: o.organizationId, label: o.organizationName }));
  }, [visibleOrgs, employments]);

  const activeEmploymentCount = useMemo(
    () => employments.filter((e) => e.status === "ACTIVE").length,
    [employments],
  );

  async function openInOrg(organizationId: string, path: string) {
    setBusy(true);
    setError(null);
    try {
      if (user?.organizationId !== organizationId) {
        await switchOrganization(organizationId);
      }
      window.location.href = path;
    } catch {
      setError(t("switchError"));
      setBusy(false);
    }
  }

  async function hireInOtherOrg() {
    if (!hireOrgId) return;
    await openInOrg(
      hireOrgId,
      `/workspace/workforce/employments?hire=1&globalPersonId=${globalPersonId}`,
    );
  }

  async function openFinance(organizationId: string, employmentId: string) {
    setBusy(true);
    setError(null);
    try {
      if (user?.organizationId !== organizationId) {
        await switchOrganization(organizationId);
      }
      const token = await ensureFreshOrchAccessToken();
      const result = await buildFinanceHandoffUrl(
        token,
        `/employees?cpEmploymentId=${employmentId}`,
      );
      if (!result.ok) {
        if (result.reason === "needs_relogin") {
          window.location.assign("/login?reason=session_expired");
          return;
        }
        setError(
          result.reason === "finance_unavailable"
            ? t("financeUnavailable")
            : t("financeHandoffFailed"),
        );
        setBusy(false);
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch {
      setError(t("switchError"));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  const canSwitch = (orgId: string) =>
    memberships.some((m) => m.organizationId === orgId);

  const title =
    person?.accessDenied
      ? t("maskedPerson")
      : (person?.displayName?.trim() || t("personCard"));

  const backHref = holdingId
    ? `/workspace/workforce/group?holdingId=${holdingId}`
    : "/workspace/workforce/group";

  return (
    <>
      <PageHeader
        title={title}
        subtitle={t("personHint")}
        actions={
          <Link href={backHref} className={SECONDARY_BUTTON_CLASS}>
            {t("backToGroup")}
          </Link>
        }
      />

      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{tCommon("loading")}</p>
      ) : (
        <>
          {person && !person.accessDenied && person.finMasked ? (
            <p className="mb-3 text-sm text-[#7F8C8D]">
              {t("colFinMasked")}:{" "}
              <span className="font-mono text-[#34495E]">{person.finMasked}</span>
            </p>
          ) : null}

          {activeEmploymentCount >= 2 ? (
            <div className={`${CARD_CONTAINER_CLASS} mb-4 p-4 text-sm text-[#34495E]`}>
              {t("dualVoenHint")}
            </div>
          ) : null}

          {employments.length === 0 ? (
            <div className={`${CARD_CONTAINER_CLASS} p-4 text-sm text-[#7F8C8D]`}>
              {t("emptyPerson")}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {employments.map((e) => {
                const switchOk = canSwitch(e.organizationId);
                return (
                  <section key={e.employmentId} className={CARD_CONTAINER_CLASS}>
                    <h2 className="mb-2 text-base font-semibold text-[#34495E]">
                      {e.orgName}
                    </h2>
                    <dl className="space-y-1 text-sm">
                      <div>
                        <dt className="inline text-[#7F8C8D]">{t("status")}: </dt>
                        <dd className="inline">{formatStatus(e.status)}</dd>
                      </div>
                      <div>
                        <dt className="inline text-[#7F8C8D]">{t("position")}: </dt>
                        <dd className="inline">{e.position?.name ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="inline text-[#7F8C8D]">{t("orgUnit")}: </dt>
                        <dd className="inline">{e.orgUnit?.name ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="inline text-[#7F8C8D]">{t("hireDate")}: </dt>
                        <dd className="inline">
                          {String(e.hireDate).slice(0, 10)}
                        </dd>
                      </div>
                    </dl>
                    {!switchOk ? (
                      <p className="mt-2 text-xs text-[#7F8C8D]">
                        {t("switchNeeded")}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={PRIMARY_BUTTON_CLASS}
                        disabled={busy || !switchOk}
                        onClick={() =>
                          void openInOrg(
                            e.organizationId,
                            `/workspace/workforce/employments?employmentId=${e.employmentId}`,
                          )
                        }
                      >
                        {t("openInOrg")}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={
                          busy || !switchOk || e.status === "TERMINATED"
                        }
                        onClick={() =>
                          void openInOrg(
                            e.organizationId,
                            `/workspace/workforce/employments?employmentId=${e.employmentId}&login=1`,
                          )
                        }
                      >
                        {t("openLoginAccess")}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy || !switchOk}
                        onClick={() =>
                          void openInOrg(
                            e.organizationId,
                            `/workspace/workforce/absences?employmentId=${e.employmentId}`,
                          )
                        }
                      >
                        {t("openAbsences")}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy || !switchOk}
                        onClick={() =>
                          void openFinance(e.organizationId, e.employmentId)
                        }
                      >
                        {t("openFinance")}
                      </button>
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {hireOptions.length > 0 ? (
            <section className={`${CARD_CONTAINER_CLASS} mt-4`}>
              <h2 className="mb-2 text-base font-semibold text-[#34495E]">
                {t("hireOtherTitle")}
              </h2>
              <p className="mb-3 text-sm text-[#7F8C8D]">{t("hireOtherHint")}</p>
              <div className="flex flex-wrap items-end gap-3">
                <CatalogField
                  kind="ENTITY_REF"
                  label={t("filterOrg")}
                  value={hireOrgId}
                  onChange={(v) => setHireOrgId(String(v))}
                  options={hireOptions}
                  emptyLabel={tCommon("select")}
                />
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy || !hireOrgId || !canSwitch(hireOrgId)}
                  onClick={() => void hireInOtherOrg()}
                >
                  {t("hireInOrg")}
                </button>
              </div>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
