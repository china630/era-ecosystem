"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import { useListPagination } from "../../../../lib/use-list-pagination";
import {
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
                  <td className={DATA_TABLE_TD_CLASS}>{u.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{u.code ?? "—"}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{u.status}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-right tabular-nums`}>
                    {u._count?.employments ?? 0} / {u._count?.positions ?? 0}
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
