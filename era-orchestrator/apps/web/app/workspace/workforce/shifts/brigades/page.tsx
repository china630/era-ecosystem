"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DatePicker,
  EraDataGrid,
  EraListFilterBar,
  EraListWorkspace,
  LIST_PAGE_SHELL_CLASS,
  ListPaginationFooter,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { bakuDateDisplay, todayBakuYmd } from "@era/satellite-kit/time";
import { useRequireAuth } from "../../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../../components/workspace/workforce-gate";
import { WorkforceShiftsSubnav } from "../../../../../components/workspace/workforce-shifts-subnav";
import type {
  Brigade,
  BrigadeMembershipRow,
  Employment,
} from "../_lib/types";

async function readApiMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
  if (!body) return fallback;
  if (typeof body.message === "string" && body.message.trim()) return body.message;
  if (Array.isArray(body.message) && body.message.length) return body.message.map(String).join(", ");
  return fallback;
}

export default function WorkforceBrigadesPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceRoster");
  const tCommon = useTranslations("common");

  const [brigades, setBrigades] = useState<Brigade[]>([]);
  const [employments, setEmployments] = useState<Employment[]>([]);
  const [persons, setPersons] = useState<
    Record<string, { displayName: string | null }>
  >({});
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [brigadeOpen, setBrigadeOpen] = useState(false);
  const [brigadeEditId, setBrigadeEditId] = useState<string | null>(null);
  const [brigadeCode, setBrigadeCode] = useState("");
  const [brigadeName, setBrigadeName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [transferOpen, setTransferOpen] = useState(false);
  const [fromBrigadeId, setFromBrigadeId] = useState("");
  const [toBrigadeId, setToBrigadeId] = useState("");
  const [transferIds, setTransferIds] = useState<string[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState(todayBakuYmd);
  const [transferError, setTransferError] = useState<string | null>(null);

  const [histItems, setHistItems] = useState<BrigadeMembershipRow[]>([]);
  const [histTotal, setHistTotal] = useState(0);
  const [histPage, setHistPage] = useState(1);
  const [histPageSize, setHistPageSize] = useState(25);
  const [filterBrigadeId, setFilterBrigadeId] = useState("");
  const [filterEmploymentId, setFilterEmploymentId] = useState("");

  const personLabel = useCallback(
    (employmentId: string, globalPersonId?: string | null, staffCode?: string | null) => {
      const emp = employments.find((e) => e.id === employmentId);
      const gid = globalPersonId ?? emp?.globalPersonId;
      return (
        (gid && persons[gid]?.displayName?.trim()) ||
        staffCode ||
        emp?.staffCode ||
        tCommon("unnamedPerson")
      );
    },
    [employments, persons, tCommon],
  );

  const loadBrigades = useCallback(async () => {
    const bRes = await wfFetch("brigades");
    if (await isWorkforceGate403(bRes)) {
      setNotEntitled(true);
      return false;
    }
    setNotEntitled(false);
    if (bRes.ok) setBrigades(await bRes.json());
    else setError(t("loadError"));
    const eRes = await wfFetch("employments?status=ACTIVE&page=1&pageSize=100");
    if (eRes.ok) {
      const first = await eRes.json();
      const firstItems: Employment[] = Array.isArray(first)
        ? first
        : (first.items ?? []);
      const mergedPersons: Record<string, { displayName: string | null }> =
        !Array.isArray(first) && first.persons ? { ...first.persons } : {};
      const all = [...firstItems];
      const total = !Array.isArray(first) && typeof first.total === "number"
        ? first.total
        : firstItems.length;
      let page = 2;
      while (all.length < total && page <= 10) {
        const next = await wfFetch(
          `employments?status=ACTIVE&page=${page}&pageSize=100`,
        );
        if (!next.ok) break;
        const body = await next.json();
        const items: Employment[] = Array.isArray(body) ? body : (body.items ?? []);
        if (!items.length) break;
        all.push(...items);
        if (!Array.isArray(body) && body.persons) {
          Object.assign(mergedPersons, body.persons);
        }
        page += 1;
      }
      setEmployments(all);
      setPersons(mergedPersons);
    }
    return true;
  }, [t]);

  const loadHistory = useCallback(async () => {
    const qs = new URLSearchParams({
      page: String(histPage),
      pageSize: String(histPageSize),
    });
    if (filterBrigadeId) qs.set("brigadeId", filterBrigadeId);
    if (filterEmploymentId) qs.set("employmentId", filterEmploymentId);
    const res = await wfFetch(`brigade-memberships?${qs.toString()}`);
    if (!res.ok) return;
    const body = await res.json();
    setHistItems(Array.isArray(body.items) ? body.items : []);
    setHistTotal(typeof body.total === "number" ? body.total : 0);
  }, [histPage, histPageSize, filterBrigadeId, filterEmploymentId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const ok = await loadBrigades();
    if (ok) await loadHistory();
    setLoading(false);
  }, [loadBrigades, loadHistory]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function saveBrigade() {
    if (!brigadeName.trim() || (!brigadeEditId && !brigadeCode.trim())) {
      setFormError(t("requiredFields"));
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = brigadeEditId
      ? await wfFetch(`brigades/${brigadeEditId}`, {
          method: "PATCH",
          body: JSON.stringify({ name: brigadeName.trim() }),
        })
      : await wfFetch("brigades", {
          method: "POST",
          body: JSON.stringify({
            code: brigadeCode.trim(),
            name: brigadeName.trim(),
          }),
        });
    setBusy(false);
    if (!res.ok) {
      setFormError(await readApiMessage(res, t("saveError")));
      return;
    }
    setBrigadeOpen(false);
    await load();
  }

  function openCreateBrigade() {
    setBrigadeEditId(null);
    setBrigadeCode("");
    setBrigadeName("");
    setFormError(null);
    setBrigadeOpen(true);
  }

  function openEditBrigade(row: Brigade) {
    setBrigadeEditId(row.id);
    setBrigadeCode(row.code);
    setBrigadeName(row.name);
    setFormError(null);
    setBrigadeOpen(true);
  }

  function openTransfer(row?: Brigade) {
    setFromBrigadeId(row?.id ?? "");
    setToBrigadeId("");
    setTransferIds([]);
    setEffectiveFrom(todayBakuYmd());
    setTransferError(null);
    setTransferOpen(true);
  }

  async function submitTransfer(kind: "transfer" | "leave") {
    if (!transferIds.length || !effectiveFrom) {
      setTransferError(t("requiredFields"));
      return;
    }
    if (kind === "transfer" && !toBrigadeId) {
      setTransferError(t("requiredFields"));
      return;
    }
    if (kind === "leave" && !window.confirm(t("leaveConfirm"))) return;
    setBusy(true);
    setTransferError(null);
    setNotice(null);
    const res =
      kind === "leave"
        ? await wfFetch("brigades/leaves", {
            method: "POST",
            body: JSON.stringify({
              employmentIds: transferIds,
              effectiveFrom,
              ...(fromBrigadeId ? { fromBrigadeId } : {}),
            }),
          })
        : await wfFetch("brigades/transfers", {
            method: "POST",
            body: JSON.stringify({
              employmentIds: transferIds,
              toBrigadeId,
              effectiveFrom,
              ...(fromBrigadeId ? { fromBrigadeId } : {}),
            }),
          });
    setBusy(false);
    if (!res.ok) {
      setTransferError(await readApiMessage(res, t("saveError")));
      return;
    }
    const body = await res.json();
    if (body.movedCount === 0 && body.skippedCount > 0) {
      setNotice(t("transferNoop"));
    } else if (body.rematerializeSuggested) {
      setNotice(t("rematerializeSuggested"));
    }
    setTransferOpen(false);
    await load();
  }

  const brigadeOptions = brigades.map((b) => ({
    value: b.id,
    label: `${b.code} · ${b.name}`,
  }));

  const fromMembers = useMemo(() => {
    if (!fromBrigadeId) {
      return employments.map((e) => ({
        value: e.id,
        label: personLabel(e.id, e.globalPersonId, e.staffCode),
      }));
    }
    const brigade = brigades.find((b) => b.id === fromBrigadeId);
    const ids = new Set((brigade?.members ?? []).map((m) => m.employmentId));
    return (brigade?.members ?? [])
      .filter((m) => ids.has(m.employmentId))
      .map((m) => ({
        value: m.employmentId,
        label: personLabel(m.employmentId, m.globalPersonId, m.staffCode),
      }));
  }, [fromBrigadeId, brigades, employments, personLabel]);

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader
          className="!mb-0"
          title={t("brigadesHeading")}
          subtitle={t("brigadesHint")}
          actions={
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreateBrigade}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              {t("addBrigade")}
            </button>
          }
        />
      </div>
      <div className="shrink-0">
        <WorkforceShiftsSubnav />
      </div>

      {error ? <p className="shrink-0 text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="shrink-0 text-sm text-amber-800">{notice}</p> : null}

      <div className="flex min-h-0 flex-[1.2] flex-col">
        <EraDataGrid
          layout="fill"
          columns={[
            { key: "code", header: t("colCode") },
            { key: "name", header: t("colName") },
            {
              key: "members",
              header: t("colMembers"),
              render: (row) => {
                const names = (row.members ?? []).map((m) =>
                  personLabel(m.employmentId, m.globalPersonId, m.staffCode),
                );
                return names.length ? names.join(", ") : "—";
              },
            },
            {
              key: "actions",
              header: "",
              className: "w-48",
              render: (row) => (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => openTransfer(row)}
                  >
                    {t("transfer")}
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => openEditBrigade(row)}
                  >
                    {tCommon("edit")}
                  </button>
                </div>
              ),
            },
          ]}
          rows={brigades}
          rowKey={(row) => row.id}
          emptyMessage={loading ? tCommon("loading") : t("brigadesEmpty")}
          paginationLabels={{
            rowsPerPage: tCommon("paginationRowsPerPage"),
            pageOf: tCommon("paginationPageOf"),
            prev: tCommon("paginationPrev"),
            next: tCommon("paginationNext"),
          }}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0">
          <h2 className="text-sm font-semibold text-[#2C3E50]">{t("historyHeading")}</h2>
          <p className="text-xs text-[#7F8C8D]">{t("historyHint")}</p>
        </div>
        <EraListWorkspace
          filter={
            <EraListFilterBar
              className="!mb-0"
              resetLabel={tCommon("filterReset")}
              onReset={() => {
                setFilterBrigadeId("");
                setFilterEmploymentId("");
                setHistPage(1);
              }}
            >
              <CatalogField
                kind="ENTITY_REF"
                label={t("brigade")}
                value={filterBrigadeId}
                onChange={(v) => {
                  setFilterBrigadeId(String(v));
                  setHistPage(1);
                }}
                options={brigadeOptions}
                emptyLabel={t("allBrigades")}
              />
              <CatalogField
                kind="ENTITY_REF"
                label={t("employment")}
                value={filterEmploymentId}
                onChange={(v) => {
                  setFilterEmploymentId(String(v));
                  setHistPage(1);
                }}
                options={employments.map((e) => ({
                  value: e.id,
                  label: personLabel(e.id, e.globalPersonId, e.staffCode),
                }))}
                emptyLabel={t("allPeople")}
              />
            </EraListFilterBar>
          }
          table={
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPerson")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("brigade")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colFrom")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colTo")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colNextBrigade")}</th>
                </tr>
              </thead>
              <tbody>
                {histItems.length === 0 ? (
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td
                      className={`${DATA_TABLE_TD_CLASS} py-8 text-center text-[#7F8C8D]`}
                      colSpan={5}
                    >
                      {loading ? tCommon("loading") : t("historyEmpty")}
                    </td>
                  </tr>
                ) : (
                  histItems.map((row) => (
                    <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {personLabel(row.employmentId, row.globalPersonId, row.staffCode)}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.brigade.code} · {row.brigade.name}
                      </td>
                      <td className={`${DATA_TABLE_TD_CLASS} tabular-nums whitespace-nowrap`}>
                        {bakuDateDisplay(row.effectiveFrom)}
                      </td>
                      <td className={`${DATA_TABLE_TD_CLASS} tabular-nums whitespace-nowrap`}>
                        {row.effectiveTo ? bakuDateDisplay(row.effectiveTo) : t("openEnded")}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.leftToBrigade
                          ? `${row.leftToBrigade.code} · ${row.leftToBrigade.name}`
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          }
          footer={
            <ListPaginationFooter
              page={histPage}
              pageSize={histPageSize}
              total={histTotal}
              onPageChange={setHistPage}
              onPageSizeChange={(size) => {
                setHistPageSize(size);
                setHistPage(1);
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
      </div>

      <ModalShell
        open={brigadeOpen}
        onClose={() => setBrigadeOpen(false)}
        title={brigadeEditId ? t("renameBrigade") : t("addBrigade")}
        closeLabel={tCommon("close")}
        footer={
          <ModalFooter
            onCancel={() => setBrigadeOpen(false)}
            onSubmit={() => void saveBrigade()}
            busy={busy}
            cancelLabel={tCommon("cancel")}
            submitLabel={tCommon("save")}
          />
        }
      >
        <div className="space-y-3">
          {!brigadeEditId ? (
            <CatalogField
              kind="FREE_TEXT"
              label={t("colCode")}
              value={brigadeCode}
              onChange={(v) => setBrigadeCode(String(v))}
              options={[]}
            />
          ) : null}
          <CatalogField
            kind="FREE_TEXT"
            label={t("colName")}
            value={brigadeName}
            onChange={(v) => setBrigadeName(String(v))}
            options={[]}
          />
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
      </ModalShell>

      <ModalShell
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title={t("transferTitle")}
        closeLabel={tCommon("close")}
        footer={
          <ModalFooter
            onCancel={() => setTransferOpen(false)}
            onSubmit={() => void submitTransfer("transfer")}
            busy={busy}
            cancelLabel={tCommon("cancel")}
            submitLabel={t("transfer")}
          />
        }
      >
        <div className="space-y-3">
          <CatalogField
            kind="ENTITY_REF"
            label={t("fromBrigade")}
            value={fromBrigadeId}
            onChange={(v) => {
              setFromBrigadeId(String(v));
              setTransferIds([]);
            }}
            options={brigadeOptions}
            emptyLabel={t("allBrigades")}
          />
          <CatalogField
            kind="MULTI"
            label={t("colMembers")}
            value={transferIds}
            onChange={(v) => setTransferIds(Array.isArray(v) ? v.map(String) : [])}
            options={fromMembers}
          />
          <CatalogField
            kind="ENTITY_REF"
            label={t("toBrigade")}
            value={toBrigadeId}
            onChange={(v) => setToBrigadeId(String(v))}
            options={brigadeOptions.filter((o) => o.value !== fromBrigadeId)}
            emptyLabel={t("toBrigade")}
          />
          <DatePicker
            label={t("effectiveFrom")}
            value={effectiveFrom}
            onChange={setEffectiveFrom}
            placeholder={tCommon("datePlaceholder")}
            fluid
          />
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => void submitTransfer("leave")}
          >
            {t("leaveCrew")}
          </button>
          {transferError ? <p className="text-sm text-red-600">{transferError}</p> : null}
        </div>
      </ModalShell>
    </div>
  );
}
