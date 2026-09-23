"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  DEFAULT_LIST_PAGE_SIZE,
  EraListFilterBar,
  ListPaginationFooter,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../../../lib/auth-context";
import { orchFetch } from "../../../../lib/orch-api";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

type Holding = { id: string; name: string };
type VisibleOrg = { organizationId: string; organizationName: string };
type EmpRow = {
  organizationId: string;
  orgName: string;
  employmentId: string;
  status: string;
  staffCode: string;
  hireDate: string;
  orgUnit?: { name: string } | null;
  position?: { name: string } | null;
};
type PersonRow = {
  globalPersonId: string;
  displayName: string | null;
  employments: EmpRow[];
};

export default function WorkforceGroupPage() {
  const { ready, token } = useRequireAuth();
  const { memberships } = useAuth();
  const t = useTranslations("workforceGroup");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [holdingId, setHoldingId] = useState(
    () => searchParams.get("holdingId") ?? "",
  );
  const [visibleOrgs, setVisibleOrgs] = useState<VisibleOrg[]>([]);
  const [filterOrgId, setFilterOrgId] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [items, setItems] = useState<PersonRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHoldings = useCallback(async () => {
    if (!token) return;
    const res = await orchFetch("/v1/holdings", { token });
    if (!res.ok) return;
    const list = (await res.json()) as Holding[];
    setHoldings(list);
    const fromUrl = searchParams.get("holdingId");
    setHoldingId((prev) => {
      if (prev && list.some((h) => h.id === prev)) return prev;
      if (fromUrl && list.some((h) => h.id === fromUrl)) return fromUrl;
      return list[0]?.id || "";
    });
  }, [token, searchParams]);

  const loadDirectory = useCallback(async () => {
    if (!holdingId) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      holdingId,
      page: String(page),
      pageSize: String(pageSize),
    });
    if (filterOrgId) qs.set("organizationId", filterOrgId);
    if (status) qs.set("status", status);
    if (debouncedQ.trim()) qs.set("q", debouncedQ.trim());
    const res = await wfFetch(`holding-directory?${qs}`);
    if (await isWorkforceGate403(res)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const code = body?.code as string | undefined;
      setError(
        code === "HOLDING_HR_FORBIDDEN"
          ? t("forbidden")
          : typeof body?.message === "string"
            ? body.message
            : t("loadError"),
      );
      setItems([]);
      setVisibleOrgs([]);
      setLoading(false);
      return;
    }
    const body = await res.json();
    setItems(body.items ?? []);
    setTotal(body.total ?? 0);
    setVisibleOrgs(body.visibleOrgs ?? []);
    setLoading(false);
  }, [holdingId, page, pageSize, filterOrgId, status, debouncedQ, t]);

  useEffect(() => {
    if (ready) void loadHoldings();
  }, [ready, loadHoldings]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, filterOrgId, status, holdingId, pageSize]);

  useEffect(() => {
    if (ready && holdingId) void loadDirectory();
  }, [ready, holdingId, loadDirectory]);

  const holdingOptions = useMemo(
    () => holdings.map((h) => ({ value: h.id, label: h.name })),
    [holdings],
  );
  const orgOptions = useMemo(
    () => [
      { value: "", label: t("allOrgs") },
      ...visibleOrgs.map((o) => ({
        value: o.organizationId,
        label: o.organizationName,
      })),
    ],
    [visibleOrgs, t],
  );

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("hint")} />
      <EraListFilterBar
        resetLabel={tCommon("filterReset")}
        onReset={() => {
          setFilterOrgId("");
          setStatus("");
          setQ("");
          setPage(1);
        }}
      >
        <CatalogField
          kind="ENTITY_REF"
          label={t("holding")}
          value={holdingId}
          onChange={(v) => {
            setHoldingId(String(v));
            setFilterOrgId("");
          }}
          options={holdingOptions}
          emptyLabel={tCommon("select")}
        />
        <CatalogField
          kind="ENTITY_REF"
          label={t("filterOrg")}
          value={filterOrgId}
          onChange={(v) => setFilterOrgId(String(v))}
          options={orgOptions}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("status")}
          value={status}
          onChange={(v) => setStatus(String(v))}
          options={[
            { value: "ACTIVE", label: t("statusActive") },
            { value: "TERMINATED", label: t("statusTerminated") },
          ]}
          emptyLabel={t("statusAll")}
        />
        <CatalogField
          kind="FREE_TEXT"
          label={t("search")}
          value={q}
          onChange={(v) => setQ(String(v))}
          options={[]}
        />
      </EraListFilterBar>
      <div className={CARD_CONTAINER_CLASS}>
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
        {!holdingId && holdings.length === 0 ? (
          <p className="text-sm text-[var(--era-muted)]">{t("noHoldings")}</p>
        ) : null}
        {loading ? (
          <p className="text-sm text-[var(--era-muted)]">{tCommon("loading")}</p>
        ) : (
          <>
            <div className={DATA_TABLE_VIEWPORT_CLASS}>
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPerson")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colFirms")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.globalPersonId} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.displayName?.trim() || tCommon("unnamedPerson")}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.employments
                          .map(
                            (e) =>
                              `${e.orgName} (${e.status}${e.position?.name ? ` · ${e.position.name}` : ""})`,
                          )
                          .join(" · ")}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <Link
                          className="text-sm underline"
                          href={`/workspace/workforce/group/persons/${row.globalPersonId}?holdingId=${holdingId}`}
                        >
                          {t("openCard")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ListPaginationFooter
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
              labels={{
                rowsPerPage: tCommon("paginationRowsPerPage"),
                pageOf: tCommon("paginationPageOf"),
                prev: tCommon("paginationPrev"),
                next: tCommon("paginationNext"),
              }}
            />
          </>
        )}
        {memberships.length > 0 ? (
          <p className="mt-3 text-xs text-[var(--era-muted)]">{t("mutateHint")}</p>
        ) : null}
        <div className="mt-3">
          <Link href="/workspace/workforce/employments" className={SECONDARY_BUTTON_CLASS}>
            {t("openOrgEmployments")}
          </Link>
        </div>
      </div>
    </div>
  );
}
