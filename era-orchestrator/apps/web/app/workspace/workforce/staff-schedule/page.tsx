"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  FileText,
  List,
  MoreHorizontal,
  Plus,
  Send,
} from "lucide-react";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ListPaginationFooter,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import { useListPagination } from "../../../../lib/use-list-pagination";
import {
  isWorkforceGate403,
  workforceFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

type RevRow = {
  id: string;
  title: string;
  status: string;
  createdAt?: string;
  snapshotJson?: SnapshotRow[];
};

type SnapshotRow = {
  positionId: string;
  name: string;
  orgUnitName: string;
  totalSlots: number;
  occupied: number;
  vacant: number;
};

export default function StaffSchedulePage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceStaffSchedule");
  const tCommon = useTranslations("common");
  const [rows, setRows] = useState<RevRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotRow[]>([]);
  const [confirmAct, setConfirmAct] = useState<{
    id: string;
    action: "submit" | "approve";
  } | null>(null);
  const [moreMenuId, setMoreMenuId] = useState<string | null>(null);
  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination(rows);

  useEffect(() => {
    if (!moreMenuId) return;
    const onDoc = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("[data-schedule-more-menu]")) return;
      setMoreMenuId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreMenuId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await workforceFetch("staff-schedule");
    if (await isWorkforceGate403(res)) {
      setGated(true);
      setLoading(false);
      return;
    }
    setGated(false);
    if (!res.ok) {
      setError(t("loadFailed"));
      setRows([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as RevRow[] | { items?: RevRow[] };
    setRows(Array.isArray(data) ? data : (data.items ?? []));
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await workforceFetch("staff-schedule", {
        method: "POST",
        body: JSON.stringify({ title: title.trim() || t("defaultTitle") }),
      });
      if (!res.ok) {
        setError(t("createFailed"));
        return;
      }
      setTitle("");
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "submit" | "approve") {
    setBusy(true);
    setConfirmAct(null);
    try {
      const res = await workforceFetch(`staff-schedule/${id}/${action}`, {
        method: "POST",
        body: "{}",
      });
      if (!res.ok) {
        setError(t("actionFailed"));
        return;
      }
      await load();
      if (expandedId === id) await toggleExpand(id);
    } finally {
      setBusy(false);
    }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setSnapshot([]);
      return;
    }
    const res = await workforceFetch(`staff-schedule/${id}`);
    if (!res.ok) {
      setError(t("loadFailed"));
      return;
    }
    const row = (await res.json()) as RevRow;
    const snap = Array.isArray(row.snapshotJson) ? row.snapshotJson : [];
    setSnapshot(snap);
    setExpandedId(id);
  }

  async function downloadPdf(id: string) {
    const res = await workforceFetch(`staff-schedule/${id}/pdf`);
    if (!res.ok) {
      setError(t("pdfFailed"));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-schedule-${id.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!ready) return null;
  if (gated) return <WorkforceGate onEnabled={() => void load()} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => setOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {t("create")}
          </button>
        }
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colTitle")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colDate")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={4}>
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                paged.map((r) => (
                  <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{r.title}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {t(`status.${r.status}` as "status.DRAFT")}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {r.createdAt ? String(r.createdAt).slice(0, 10) : "—"}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="relative flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          title={
                            expandedId === r.id ? t("hideSlots") : t("showSlots")
                          }
                          aria-label={
                            expandedId === r.id ? t("hideSlots") : t("showSlots")
                          }
                          onClick={() => void toggleExpand(r.id)}
                        >
                          <List className="h-4 w-4 text-[#2980B9]" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          title={t("submit")}
                          aria-label={t("submit")}
                          disabled={busy || r.status !== "DRAFT"}
                          onClick={() =>
                            setConfirmAct({ id: r.id, action: "submit" })
                          }
                        >
                          <Send className="h-4 w-4 text-[#2980B9]" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          title={t("approve")}
                          aria-label={t("approve")}
                          disabled={busy || r.status !== "SUBMITTED"}
                          onClick={() =>
                            setConfirmAct({ id: r.id, action: "approve" })
                          }
                        >
                          <Check className="h-4 w-4 text-[#27AE60]" aria-hidden />
                        </button>
                        <div className="relative" data-schedule-more-menu="">
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            title={t("moreActions")}
                            aria-label={t("moreActions")}
                            disabled={busy}
                            onClick={() =>
                              setMoreMenuId((id) => (id === r.id ? null : r.id))
                            }
                          >
                            <MoreHorizontal
                              className="h-4 w-4 text-[#7F8C8D]"
                              aria-hidden
                            />
                          </button>
                          {moreMenuId === r.id ? (
                            <div className="absolute right-0 z-10 mt-1 min-w-[11rem] rounded-lg border border-[#D5DADF] bg-white py-1 shadow-md">
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#34495E] hover:bg-[#F4F6F7] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={r.status === "DRAFT"}
                                onClick={() => {
                                  setMoreMenuId(null);
                                  void downloadPdf(r.id);
                                }}
                              >
                                <FileText className="h-3.5 w-3.5" aria-hidden />
                                {t("pdf")}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
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
      {expandedId && snapshot.length > 0 ? (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPosition")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colOrgUnit")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colOccupied")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colVacant")}</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.map((s) => (
                <tr key={s.positionId} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{s.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{s.orgUnitName}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {s.occupied}/{s.totalSlots}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{s.vacant}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <ModalShell
        open={open}
        title={t("create")}
        onClose={() => setOpen(false)}
        closeLabel={tCommon("close")}
      >
        <form className="grid gap-3" onSubmit={(e) => e.preventDefault()}>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("colTitle")}
            <input
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
              placeholder={t("titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => void create()}
          >
            {t("create")}
          </button>
        </form>
      </ModalShell>

      <ModalShell
        open={confirmAct != null}
        title={confirmAct?.action === "approve" ? t("approve") : t("submit")}
        onClose={() => setConfirmAct(null)}
        closeLabel={tCommon("close")}
        maxWidthClass="max-w-sm"
        footer={
          <ModalFooter
            onCancel={() => setConfirmAct(null)}
            onSubmit={() => {
              if (confirmAct) void act(confirmAct.id, confirmAct.action);
            }}
            cancelLabel={tCommon("cancel")}
            submitLabel={
              confirmAct?.action === "approve" ? t("approve") : t("submit")
            }
            busy={busy}
          />
        }
      >
        <p className="text-sm text-[#34495E]">
          {confirmAct?.action === "approve"
            ? t("confirmApprove")
            : t("confirmSubmit")}
        </p>
      </ModalShell>
    </div>
  );
}
