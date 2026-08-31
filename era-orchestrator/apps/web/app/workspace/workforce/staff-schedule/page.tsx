"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ListPaginationFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
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
  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination(rows);

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
                    <td className={`${DATA_TABLE_TD_CLASS} flex flex-wrap gap-2`}>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => void toggleExpand(r.id)}
                      >
                        {expandedId === r.id ? t("hideSlots") : t("showSlots")}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy || r.status !== "DRAFT"}
                        onClick={() => void act(r.id, "submit")}
                      >
                        {t("submit")}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy || r.status !== "SUBMITTED"}
                        onClick={() => void act(r.id, "approve")}
                      >
                        {t("approve")}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={r.status === "DRAFT"}
                        onClick={() => void downloadPdf(r.id)}
                      >
                        PDF
                      </button>
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
    </div>
  );
}
