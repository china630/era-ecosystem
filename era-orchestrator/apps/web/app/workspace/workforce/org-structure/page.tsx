"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, Pencil, Plus } from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ListPaginationFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  parseApiError,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import { useListPagination } from "../../../../lib/use-list-pagination";
import {
  fileToWorkforceImportBody,
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

type OrgUnit = {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  status: string;
  _count?: { employments: number; positions: number };
};

type EditState = { mode: "create" } | { mode: "edit"; unit: OrgUnit } | null;

type ImportRowResult = {
  index: number;
  status: "created" | "skipped" | "error";
  message: string;
};

type ImportResult = {
  dryRun: boolean;
  created: number;
  skipped: number;
  errors: number;
  rows: ImportRowResult[];
};

const ORG_TEMPLATE =
  "orgUnit,position,totalSlots\n" + "Resepşn,Qeydiyyatçı,2\n";

async function readWfError(res: Response): Promise<string> {
  const txt = await res.text();
  try {
    const j = JSON.parse(txt) as { message?: unknown };
    if (typeof j.message === "string") return j.message;
  } catch {
    // response body is not JSON — fall through to raw text
  }
  return txt || `${res.status}`;
}

export default function OrgStructurePage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceOrg");
  const tCommon = useTranslations("common");
  const [items, setItems] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notEntitled, setNotEntitled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editState, setEditState] = useState<EditState>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formParentId, setFormParentId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [importCsv, setImportCsv] = useState("");
  const [importXlsx, setImportXlsx] = useState<string | null>(null);
  const [importName, setImportName] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importBusy, setImportBusy] = useState<"dry" | "apply" | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await wfFetch("org-units");
    if (!res.ok) {
      if (await isWorkforceGate403(res)) {
        setNotEntitled(true);
        setItems([]);
        setLoading(false);
        return;
      }
      if (res.status === 404) {
        setError("bootstrap");
        setItems([]);
        setLoading(false);
        return;
      }
      setError(`${res.status}`);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    const data = (await res.json()) as { items: OrgUnit[] };
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void load();
  }, [ready, user?.organizationId, load]);

  async function bootstrap() {
    setBusy(true);
    const res = await wfFetch("scope/bootstrap", { method: "POST", body: "{}" });
    setBusy(false);
    if (!res.ok) {
      setError(await readWfError(res));
      return;
    }
    await load();
  }

  function openCreate() {
    setFormName("");
    setFormCode("");
    setFormParentId("");
    setFormError(null);
    setEditState({ mode: "create" });
  }

  function openEdit(unit: OrgUnit) {
    setFormName(unit.name);
    setFormCode(unit.code ?? "");
    setFormParentId(unit.parentId ?? "");
    setFormError(null);
    setEditState({ mode: "edit", unit });
  }

  async function saveUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!editState || !formName.trim()) return;
    setBusy(true);
    setFormError(null);
    const body = JSON.stringify({
      name: formName.trim(),
      code: formCode.trim() || null,
      parentId: formParentId || null,
    });
    const submit = () =>
      editState.mode === "create"
        ? wfFetch("org-units", { method: "POST", body })
        : wfFetch(`org-units/${editState.unit.id}`, { method: "PATCH", body });

    let res = await submit();
    // First unit on a fresh org: the workforce scope may not be bootstrapped yet.
    // Initialize it transparently and retry once instead of surfacing a raw 404.
    if (!res.ok && res.status === 404 && editState.mode === "create") {
      const boot = await wfFetch("scope/bootstrap", { method: "POST", body: "{}" });
      if (boot.ok) res = await submit();
    }
    setBusy(false);
    if (!res.ok) {
      setFormError(await readWfError(res));
      return;
    }
    setEditState(null);
    setError(null);
    await load();
  }

  const importReady = importCsv.trim().length > 0 || Boolean(importXlsx);

  async function onPickImportFile(file: File | null) {
    if (!file) return;
    const body = await fileToWorkforceImportBody(file);
    setImportCsv(body.csv ?? "");
    setImportXlsx(body.xlsxBase64 ?? null);
    setImportName(file.name);
    setImportResult(null);
  }

  async function runOrgImport(dryRun: boolean) {
    setImportBusy(dryRun ? "dry" : "apply");
    setError(null);
    try {
      const qs = dryRun ? "?dryRun=true" : "";
      const res = await wfFetch(`import/org-structure${qs}`, {
        method: "POST",
        body: JSON.stringify({
          ...(importCsv.trim() ? { csv: importCsv } : {}),
          ...(importXlsx ? { xlsxBase64: importXlsx } : {}),
        }),
      });
      if (!res.ok) {
        throw new Error(
          parseApiError(await res.text().catch(() => null), `Import failed (${res.status})`),
        );
      }
      setImportResult((await res.json()) as ImportResult);
      if (!dryRun) await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `${e}`);
    } finally {
      setImportBusy(null);
    }
  }

  async function archiveUnit(unit: OrgUnit) {
    if (!window.confirm(t("archiveConfirm", { name: unit.name }))) return;
    setBusy(true);
    const res = await wfFetch(`org-units/${unit.id}/archive`, { method: "POST", body: "{}" });
    setBusy(false);
    if (!res.ok) {
      setError(await readWfError(res));
      return;
    }
    await load();
  }

  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination(items);

  if (!ready) return null;

  if (notEntitled) {
    return <WorkforceGate onEnabled={load} />;
  }

  const parentOptions = items.filter(
    (u) => u.status === "ACTIVE" && (editState?.mode !== "edit" || u.id !== editState.unit.id),
  );

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {t("addUnit")}
          </button>
        }
      />

      {error === "bootstrap" ? (
        <div className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
          <p className="text-sm text-[#34495E]">{t("bootstrapHint")}</p>
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} mt-3`}
            disabled={busy}
            onClick={() => void bootstrap()}
          >
            {t("bootstrap")}
          </button>
        </div>
      ) : null}

      {error && error !== "bootstrap" ? (
        <p className="mb-3 text-sm text-red-700">{error}</p>
      ) : null}

      <div className={`${CARD_CONTAINER_CLASS} mb-4 space-y-3 p-4`}>
        <h3 className="text-sm font-semibold text-[#34495E]">{t("importTitle")}</h3>
        <p className="text-xs text-[#7F8C8D]">{t("importHint")}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => {
              setImportCsv(ORG_TEMPLATE);
              setImportXlsx(null);
              setImportName("org-structure-template.csv");
              setImportResult(null);
            }}
          >
            {t("loadTemplate")}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => importInputRef.current?.click()}
          >
            {t("chooseFile")}
          </button>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = "";
            void onPickImportFile(file);
          }}
        />
        <p className="text-xs text-[#34495E]">
          {importName
            ? t("fileSelected", { name: importName })
            : importCsv.trim()
              ? t("csvPasted")
              : t("fileNone")}
        </p>
        <label className="block text-xs font-medium text-[#34495E]">
          {t("csvEditor")}
          <textarea
            className="mt-1 block min-h-[5rem] w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 font-mono text-[12px] text-[#34495E]"
            value={importCsv}
            onChange={(e) => {
              setImportCsv(e.target.value);
              setImportXlsx(null);
              setImportName(null);
              setImportResult(null);
            }}
            placeholder={t("csvPlaceholder")}
            spellCheck={false}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={importBusy != null || !importReady}
            onClick={() => void runOrgImport(true)}
          >
            {importBusy === "dry" ? t("working") : t("validate")}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={importBusy != null || !importReady}
            onClick={() => void runOrgImport(false)}
          >
            {importBusy === "apply" ? t("working") : t("apply")}
          </button>
        </div>
        {importResult ? (
          <div className="rounded-lg border border-[#EBEDF0] bg-[#F8FAFC] p-3 text-xs text-[#34495E]">
            <p className="font-medium">
              {importResult.dryRun ? t("resultDryRun") : t("resultApplied")}:{" "}
              {t("resultSummary", {
                created: importResult.created,
                skipped: importResult.skipped,
                errors: importResult.errors,
              })}
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
              {importResult.rows.map((r) => (
                <li
                  key={`${r.index}-${r.status}-${r.message}`}
                  className={
                    r.status === "error"
                      ? "text-[#C0392B]"
                      : r.status === "created"
                        ? "text-[#27AE60]"
                        : "text-[#7F8C8D]"
                  }
                >
                  #{r.index} {r.status}: {r.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colName")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCode")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("colCounts")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((u) => (
                <tr key={u.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <Link
                      href={`/workspace/workforce/positions?orgUnitId=${encodeURIComponent(u.id)}`}
                      className="text-[#2980B9] hover:underline"
                    >
                      {u.name}
                    </Link>
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{u.code ?? "—"}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{u.status}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-right tabular-nums`}>
                    <Link
                      href={`/workspace/workforce/employments?orgUnitId=${encodeURIComponent(u.id)}`}
                      className="text-[#2980B9] hover:underline"
                    >
                      {u._count?.employments ?? 0}
                    </Link>
                    {" / "}
                    <Link
                      href={`/workspace/workforce/positions?orgUnitId=${encodeURIComponent(u.id)}`}
                      className="text-[#2980B9] hover:underline"
                    >
                      {u._count?.positions ?? 0}
                    </Link>
                  </td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                    {u.status === "ACTIVE" ? (
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          title={t("edit")}
                          aria-label={t("edit")}
                          onClick={() => openEdit(u)}
                        >
                          <Pencil className="h-4 w-4 text-[#2980B9]" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          title={t("archive")}
                          aria-label={t("archive")}
                          disabled={busy}
                          onClick={() => void archiveUnit(u)}
                        >
                          <Archive className="h-4 w-4 text-[#C0392B]" aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[#95A5A6]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ListPaginationFooter
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            labels={{
              rowsPerPage: tCommon("paginationRowsPerPage"),
              pageOf: tCommon("paginationPageOf"),
              prev: tCommon("paginationPrev"),
              next: tCommon("paginationNext"),
            }}
          />
        </div>
      )}

      <ModalShell
        open={editState != null}
        title={editState?.mode === "edit" ? t("editTitle") : t("createTitle")}
        onClose={() => setEditState(null)}
        closeLabel={tCommon("close")}
      >
        <form onSubmit={(e) => void saveUnit(e)} className="grid gap-3">
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("fieldName")}
            <input
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("fieldCode")}
            <input
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
            />
          </label>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("fieldParent")}
            <select
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              value={formParentId}
              onChange={(e) => setFormParentId(e.target.value)}
            >
              <option value="">{t("rootParent")}</option>
              {parentOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setEditState(null)}
            >
              {tCommon("cancel")}
            </button>
            <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
              {busy ? tCommon("loading") : tCommon("save")}
            </button>
          </div>
        </form>
      </ModalShell>
    </>
  );
}
