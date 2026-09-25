"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SquareArrowOutUpRight } from "lucide-react";
import {
  CatalogField,
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DEFAULT_LIST_PAGE_SIZE,
  EraListFilterBar,
  EraListWorkspace,
  LIST_PAGE_SHELL_CLASS,
  ListPaginationFooter,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { orchFetch } from "../../../../lib/orch-api";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  parseWorkforceApiError,
  workforceFetch as wfFetch,
} from "../../../../lib/workforce-fetch";

type Holding = {
  id: string;
  name: string;
  organizations?: Array<{
    id: string;
    name: string;
    operatingMode?: string;
  }>;
};
type VisibleOrg = { organizationId: string; organizationName: string };
type EmpRow = {
  organizationId: string;
  orgName: string;
  employmentId: string;
  status: string;
  hireDate: string;
  orgUnit?: { name: string } | null;
  position?: { name: string } | null;
};
type PersonRow = {
  globalPersonId: string;
  displayName: string | null;
  employments: EmpRow[];
};
type PersonProfile = {
  displayName?: string | null;
  finMasked?: string | null;
  accessDenied?: boolean;
};

export default function WorkforceGroupPage() {
  const { ready, token, user } = useRequireAuth();
  const t = useTranslations("workforceGroup");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [holdingsReady, setHoldingsReady] = useState(false);
  const [holdingId, setHoldingId] = useState(
    () => searchParams.get("holdingId") ?? "",
  );
  const [visibleOrgs, setVisibleOrgs] = useState<VisibleOrg[]>([]);
  const [filterOrgId, setFilterOrgId] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [items, setItems] = useState<PersonRow[]>([]);
  const [persons, setPersons] = useState<Record<string, PersonProfile>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [holdingsFailed, setHoldingsFailed] = useState(false);
  const skipPagedFetch = useRef(false);

  const filtersOff = holdings.length === 0;

  function formatStatus(code: string): string {
    if (code === "ACTIVE") return t("statusActive");
    if (code === "TERMINATED") return t("statusTerminated");
    return code;
  }

  function mapDirectoryError(err: { status: number; code?: string; message: string }): string {
    if (err.code === "HOLDING_HR_FORBIDDEN") return t("forbidden");
    if (err.code === "HOLDING_HR_NO_STANDALONE") return t("noStandalone");
    if (err.code === "HOLDING_HR_ORG_NOT_VISIBLE") return t("orgNotVisible");
    if (err.status === 404) return t("holdingNotFound");
    return err.message || t("loadError");
  }

  function orgsFromHolding(h: Holding | undefined): VisibleOrg[] {
    return (h?.organizations ?? [])
      .filter((o) => (o.operatingMode ?? "STANDALONE") === "STANDALONE")
      .map((o) => ({ organizationId: o.id, organizationName: o.name }));
  }

  const loadHoldings = useCallback(async () => {
    if (!token) return;
    const res = await orchFetch("/v1/holdings", { token });
    if (!res.ok) {
      setHoldings([]);
      setHoldingId("");
      setHoldingsFailed(true);
      setHoldingsReady(true);
      setLoading(false);
      return;
    }
    const list = (await res.json()) as Holding[];
    setHoldingsFailed(false);
    setHoldings(list);
    const fromUrl = searchParams.get("holdingId");
    setHoldingId((prev) => {
      const next =
        prev && list.some((h) => h.id === prev)
          ? prev
          : fromUrl && list.some((h) => h.id === fromUrl)
            ? fromUrl
            : list[0]?.id || "";
      const selected = list.find((h) => h.id === next);
      setVisibleOrgs(orgsFromHolding(selected));
      return next;
    });
    setHoldingsReady(true);
    if (list.length === 0) setLoading(false);
  }, [token, searchParams, user?.organizationId]);

  const loadDirectory = useCallback(
    async (pageToLoad: number) => {
      if (!holdingId) {
        setItems([]);
        setPersons({});
        setTotal(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams({
        holdingId,
        page: String(pageToLoad),
        pageSize: String(pageSize),
      });
      if (filterOrgId) qs.set("organizationId", filterOrgId);
      if (status) qs.set("status", status);
      if (debouncedQ.trim()) qs.set("q", debouncedQ.trim());
      const res = await wfFetch(`holding-directory?${qs}`);
      if (await isWorkforceGate403(res)) {
        setError(t("needWorkforce"));
        setItems([]);
        setPersons({});
        setTotal(0);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(mapDirectoryError(await parseWorkforceApiError(res)));
        setItems([]);
        setPersons({});
        setLoading(false);
        return;
      }
      const body = await res.json();
      setItems(body.items ?? []);
      setPersons(body.persons ?? {});
      setTotal(body.total ?? 0);
      if (Array.isArray(body.visibleOrgs) && body.visibleOrgs.length) {
        setVisibleOrgs(body.visibleOrgs);
      }
      setLoading(false);
    },
    [holdingId, pageSize, filterOrgId, status, debouncedQ, t],
  );

  useEffect(() => {
    if (ready) void loadHoldings();
  }, [ready, loadHoldings]);

  useEffect(() => {
    if (!holdingId || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("holdingId") === holdingId) return;
    url.searchParams.set("holdingId", holdingId);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [holdingId]);

  useEffect(() => {
    if (page !== 1) skipPagedFetch.current = true;
    setPage(1);
    if (!ready || !holdingsReady) return;
    if (!holdingId) {
      setLoading(false);
      return;
    }
    void loadDirectory(1);
  }, [ready, holdingsReady, holdingId, filterOrgId, status, debouncedQ, pageSize, loadDirectory]);

  useEffect(() => {
    if (page === 1) return;
    if (skipPagedFetch.current) {
      skipPagedFetch.current = false;
      return;
    }
    if (!ready || !holdingsReady || !holdingId) return;
    void loadDirectory(page);
  }, [page, ready, holdingsReady, holdingId, loadDirectory]);

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

  const filtersActive = Boolean(filterOrgId || status || q.trim());

  if (!ready) return null;

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader
          className="!mb-0"
          title={t("title")}
          subtitle={t("hint")}
          actions={
            <Link
              href="/workspace/workforce/employments"
              className={SECONDARY_BUTTON_CLASS}
            >
              {t("openOrgEmployments")}
            </Link>
          }
        />
      </div>

      {error ? <p className="shrink-0 text-sm text-red-700">{error}</p> : null}

      {holdingsReady && holdings.length === 0 ? (
        <div className={`${CARD_CONTAINER_CLASS} shrink-0 p-6`}>
          <p className="text-sm text-[#34495E]">
            {holdingsFailed ? t("holdingsLoadFailed") : t("noHoldings")}
          </p>
          <p className="mt-2 text-sm text-[#7F8C8D]">{t("noHoldingsHint")}</p>
          <Link
            href="/holdings"
            className={`${SECONDARY_BUTTON_CLASS} mt-4 inline-flex`}
          >
            {t("openHoldings")}
          </Link>
        </div>
      ) : (
        <EraListWorkspace
          filter={
            <EraListFilterBar
              className="!mb-0"
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
                  const id = String(v);
                  setHoldingId(id);
                  setFilterOrgId("");
                  setItems([]);
                  setVisibleOrgs(
                    orgsFromHolding(holdings.find((h) => h.id === id)),
                  );
                }}
                options={holdingOptions}
                emptyLabel={tCommon("select")}
                disabled={filtersOff}
              />
              <CatalogField
                kind={visibleOrgs.length > 12 ? "SEARCHABLE" : "CLOSED_SMALL"}
                label={t("filterOrg")}
                value={filterOrgId}
                onChange={(v) => setFilterOrgId(String(v))}
                options={orgOptions}
                disabled={filtersOff}
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
                disabled={filtersOff}
              />
              <CatalogField
                kind="FREE_TEXT"
                label={t("search")}
                value={q}
                onChange={(v) => setQ(String(v))}
                options={[]}
                disabled={filtersOff}
              />
            </EraListFilterBar>
          }
          table={
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPerson")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colFinMasked")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colFirms")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td
                      className={`${DATA_TABLE_TD_CLASS} py-8 text-center text-[#7F8C8D]`}
                      colSpan={4}
                    >
                      {!holdingsReady || loading
                        ? tCommon("loading")
                        : filtersActive
                          ? t("emptyFiltered")
                          : t("empty")}
                      {holdingsReady && !loading ? (
                        <p className="mt-2 text-xs">{t("mutateHint")}</p>
                      ) : null}
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const profile = persons[row.globalPersonId];
                    const cardHref = `/workspace/workforce/group/persons/${row.globalPersonId}?holdingId=${holdingId}`;
                    const name =
                      row.displayName?.trim() ||
                      (profile?.accessDenied
                        ? t("maskedPerson")
                        : tCommon("unnamedPerson"));
                    return (
                      <tr key={row.globalPersonId} className={DATA_TABLE_TR_CLASS}>
                        <td className={DATA_TABLE_TD_CLASS}>
                          <Link
                            href={cardHref}
                            className="text-[#2980B9] hover:underline"
                          >
                            {name}
                          </Link>
                        </td>
                        <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs`}>
                          {profile?.accessDenied
                            ? "—"
                            : (profile?.finMasked ?? "—")}
                        </td>
                        <td className={DATA_TABLE_TD_CLASS}>
                          <ul className="m-0 grid list-none gap-1 p-0">
                            {row.employments.map((e) => (
                              <li key={e.employmentId} className="text-[13px] leading-snug">
                                <span className="text-[#34495E]">{e.orgName}</span>
                                {e.position?.name ? (
                                  <span className="text-[#7F8C8D]">
                                    {" · "}
                                    {e.position.name}
                                  </span>
                                ) : null}
                                <span className="text-[#7F8C8D]">
                                  {" · "}
                                  {formatStatus(e.status)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className={DATA_TABLE_TD_CLASS}>
                          <Link
                            href={cardHref}
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            title={t("openCard")}
                            aria-label={t("openCard")}
                          >
                            <SquareArrowOutUpRight
                              className="h-4 w-4 text-[#2980B9]"
                              aria-hidden
                            />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          }
          footer={
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
          }
        />
      )}
    </div>
  );
}
