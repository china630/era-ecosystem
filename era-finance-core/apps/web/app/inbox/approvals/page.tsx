"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { apiFetch } from "../../../lib/api-client";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_INPUT_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";

type Row = {
  id: string;
  documentType: string;
  entityId: string;
  status: string;
  currentStepNo: number;
  totalSteps: number;
  createdAt: string;
};

export default function ApprovalsInboxPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const search = useSearchParams();
  const highlightRequest = search.get("request");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    const res = await apiFetch("/api/approvals/inbox");
    if (!res.ok) {
      setErr(await res.text());
      setRows([]);
    } else {
      setRows((await res.json()) as Row[]);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  async function approve(r: Row) {
    if (!token) return;
    setBusy(r.id);
    const res = await apiFetch(
      `/api/approvals/requests/${encodeURIComponent(r.id)}/steps/${encodeURIComponent(String(r.currentStepNo))}/approve`,
      { method: "POST" },
    );
    setBusy(null);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(t("common.save"));
    await load();
  }

  async function reject(r: Row) {
    if (!token) return;
    const c = rejectComment.trim();
    if (!c) {
      toast.error(t("approvals.rejectCommentLabel"));
      return;
    }
    setBusy(r.id);
    const res = await apiFetch(
      `/api/approvals/requests/${encodeURIComponent(r.id)}/steps/${encodeURIComponent(String(r.currentStepNo))}/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: c }),
      },
    );
    setBusy(null);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    setRejectFor(null);
    setRejectComment("");
    toast.success(t("common.save"));
    await load();
  }

  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader title={t("approvals.inboxTitle")} subtitle={t("nav.approvalsInbox")} />
      {err ? <p className="text-sm text-red-600">{t("approvals.loadErr")}: {err}</p> : null}
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("common.loading")}</p> : null}
      {!loading && rows.length === 0 ? <EmptyState title={t("approvals.empty")} /> : null}
      {!loading && rows.length > 0 ? (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("approvals.step")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("approvals.rejectCommentLabel")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={`${DATA_TABLE_TR_CLASS}${
                    highlightRequest === r.id ? " bg-[#2980B9]/5 ring-1 ring-inset ring-[#2980B9]/30" : ""
                  }`}
                >
                  <td className={DATA_TABLE_TD_CLASS}>
                    <div className="font-medium text-[#34495E]">
                      {r.documentType} · {r.entityId.slice(0, 8)}…
                    </div>
                    <div className="mt-1 text-[12px] text-[#7F8C8D]">
                      {t("approvals.step")}: {r.currentStepNo}/{r.totalSteps}
                    </div>
                    <div className="mt-1">
                      <Badge variant="neutral">
                        {(() => {
                          const key = `approvals.status.${r.status}`;
                          const label = t(key);
                          return label === key ? r.status : label;
                        })()}
                      </Badge>
                    </div>
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {rejectFor === r.id ? (
                      <textarea
                        className={`${MODAL_INPUT_CLASS} w-full min-w-[14rem]`}
                        rows={3}
                        value={rejectComment}
                        onChange={(e) => setRejectComment(e.target.value)}
                        placeholder={t("approvals.rejectCommentLabel")}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        disabled={busy === r.id}
                        onClick={() => void approve(r)}
                      >
                        {t("approvals.approve")}
                      </Button>
                      {rejectFor === r.id ? (
                        <>
                          <Button
                            type="button"
                            variant="primary"
                            disabled={busy === r.id}
                            onClick={() => void reject(r)}
                          >
                            {t("approvals.reject")}
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => setRejectFor(null)}>
                            {t("activityStream.cancel")}
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy === r.id}
                          onClick={() => {
                            setRejectFor(r.id);
                            setRejectComment("");
                          }}
                        >
                          {t("approvals.reject")}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
