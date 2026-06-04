"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AcceptNetworkDocumentModal } from "../../../components/network/AcceptNetworkDocumentModal";
import { PageHeader } from "../../../components/layout/page-header";
import { Badge } from "../../../components/ui/badge";
import { apiFetch } from "../../../lib/api-client";
import { formatMoneyAzn } from "../../../lib/format-money";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";

type InboxRow = {
  id: string;
  issuerName: string;
  issuerInvoiceNumber: string | null;
  totalGross: string;
  currency: string;
  createdAt: string;
  status: string;
  eQaimeRef?: string | null;
  eqaimeStatus?: "MATCH" | "MISMATCH" | "MISSING";
};

export default function NetworkInboxPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acceptId, setAcceptId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [eqaimeDocId, setEqaimeDocId] = useState<string | null>(null);
  const [eqaimeRefInput, setEqaimeRefInput] = useState("");
  const [eqaimeBusy, setEqaimeBusy] = useState(false);
  const [acceptInbound, setAcceptInbound] = useState<boolean | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await apiFetch("/api/network/documents/inbox");
    if (!res.ok) {
      toast.error(await res.text());
      setRows([]);
      setPendingCount(0);
    } else {
      const data = (await res.json()) as { items?: InboxRow[]; pendingCount?: number };
      setRows(data.items ?? []);
      setPendingCount(data.pendingCount ?? data.items?.length ?? 0);
    }
    setLoading(false);
  }, [token]);

  const loadSettings = useCallback(async () => {
    if (!token) return;
    const res = await apiFetch("/api/organization/settings");
    if (!res.ok) return;
    const data = (await res.json()) as { settings?: { networkDocuments?: { acceptInbound?: boolean } } };
    setAcceptInbound(data.settings?.networkDocuments?.acceptInbound === true);
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    void load();
    void loadSettings();
  }, [ready, load, loadSettings]);

  async function toggleAcceptInbound() {
    setSettingsBusy(true);
    const res = await apiFetch("/api/organization/settings/network-documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptInbound: !acceptInbound }),
    });
    setSettingsBusy(false);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    const data = (await res.json()) as { networkDocuments?: { acceptInbound?: boolean } };
    setAcceptInbound(data.networkDocuments?.acceptInbound === true);
    toast.success(t("common.save"));
  }

  async function sendToEqaime(docId: string) {
    setEqaimeBusy(true);
    const res = await apiFetch(
      `/api/network/documents/inbox/${encodeURIComponent(docId)}/eqaime-prefill`,
    );
    setEqaimeBusy(false);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    const prefill = await res.json();
    try {
      await navigator.clipboard.writeText(JSON.stringify(prefill, null, 2));
      toast.success(
        t("networkInbox.eqaimeCopied", { defaultValue: "Prefill mübadilə buferinə köçürüldü" }),
      );
    } catch {
      toast.success(t("networkInbox.eqaimeReady", { defaultValue: "Prefill hazırdır" }));
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem("erafinanceAssistantBulkFlow", "eqaime");
      window.localStorage.setItem(
        "erafinanceNetworkEqaimePrefill",
        JSON.stringify(prefill),
      );
    }
  }

  async function saveEqaimeRef() {
    if (!eqaimeDocId || !eqaimeRefInput.trim()) return;
    setEqaimeBusy(true);
    const res = await apiFetch(
      `/api/network/documents/inbox/${encodeURIComponent(eqaimeDocId)}/eqaime-ref`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalId: eqaimeRefInput.trim() }),
      },
    );
    setEqaimeBusy(false);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(t("networkInbox.eqaimeLinked", { defaultValue: "e-Qaimə bağlandı" }));
    setEqaimeDocId(null);
    setEqaimeRefInput("");
    await load();
  }

  async function submitReject() {
    if (!rejectId || !rejectReason.trim()) return;
    const res = await apiFetch(
      `/api/network/documents/inbox/${encodeURIComponent(rejectId)}/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      },
    );
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(t("networkInbox.rejectDone", { defaultValue: "Rədd edildi" }));
    setRejectId(null);
    setRejectReason("");
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
    <div className="w-full max-w-none space-y-6">
      <PageHeader
        title={t("networkInbox.title", { defaultValue: "Şəbəkə sənədləri" })}
        subtitle={t("networkInbox.subtitle", {
          defaultValue: "Digər ERA şirkətlərindən daxil olan hesab-fakturalar",
        })}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {pendingCount > 0 ? (
              <Badge variant="neutral">{pendingCount}</Badge>
            ) : null}
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={settingsBusy || acceptInbound === null}
              onClick={() => void toggleAcceptInbound()}
            >
              {acceptInbound
                ? t("networkInbox.optInOn", { defaultValue: "Qəbul aktiv" })
                : t("networkInbox.optInOff", { defaultValue: "Qəbulu aktiv et" })}
            </button>
          </div>
        }
      />

      {loading ? <p className="text-gray-600">{t("common.loading")}</p> : null}
      {!loading ? (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={`${DATA_TABLE_CLASS} min-w-full`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>
                  {t("networkInbox.issuer", { defaultValue: "Göndərən" })}
                </th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>
                  {t("networkInbox.invoiceNo", { defaultValue: "Hesab №" })}
                </th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                  {t("networkInbox.amount", { defaultValue: "Məbləğ" })}
                </th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>
                  {t("networkInbox.date", { defaultValue: "Tarix" })}
                </th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>e-Qaimə</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={6} className={`${DATA_TABLE_TD_CLASS} py-8 text-center text-slate-500`}>
                    {t("networkInbox.empty", { defaultValue: "Gözləyən sənəd yoxdur" })}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{r.issuerName}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{r.issuerInvoiceNumber ?? "—"}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                      {formatMoneyAzn(r.totalGross)} {r.currency}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{r.createdAt.slice(0, 10)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {r.eqaimeStatus === "MATCH" ? (
                        <Badge variant="success">{r.eQaimeRef ?? "✓"}</Badge>
                      ) : r.eqaimeStatus === "MISMATCH" ? (
                        <Badge variant="accountant">{t("networkInbox.eqaimeMismatch", { defaultValue: "Uyğunsuz" })}</Badge>
                      ) : (
                        <Badge variant="neutral">{t("networkInbox.eqaimeMissing", { defaultValue: "Yoxdur" })}</Badge>
                      )}
                    </td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          disabled={eqaimeBusy}
                          onClick={() => void sendToEqaime(r.id)}
                        >
                          {t("networkInbox.sendEqaime", { defaultValue: "e-Qaimə-yə göndər" })}
                        </button>
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          onClick={() => {
                            setEqaimeDocId(r.id);
                            setEqaimeRefInput(r.eQaimeRef ?? "");
                          }}
                        >
                          {t("networkInbox.linkEqaime", { defaultValue: "e-Qaimə ID" })}
                        </button>
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          onClick={() => setAcceptId(r.id)}
                        >
                          {t("networkInbox.accept", { defaultValue: "Qəbul et" })}
                        </button>
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          onClick={() => {
                            setRejectId(r.id);
                            setRejectReason("");
                          }}
                        >
                          {t("networkInbox.reject", { defaultValue: "Rədd et" })}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      <AcceptNetworkDocumentModal
        open={acceptId != null}
        documentId={acceptId ?? ""}
        onClose={() => setAcceptId(null)}
        onAccepted={() => void load()}
      />

      {eqaimeDocId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#D5DADF] bg-white p-4 shadow-lg">
            <h3 className="m-0 text-lg font-semibold text-[#34495E]">
              {t("networkInbox.linkEqaimeTitle", { defaultValue: "e-Qaimə external ID" })}
            </h3>
            <input
              className="mt-3 w-full rounded-lg border border-[#D5DADF] p-2 text-[13px] text-[#34495E]"
              value={eqaimeRefInput}
              onChange={(e) => setEqaimeRefInput(e.target.value)}
              placeholder="eqaime-doc-id"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => {
                  setEqaimeDocId(null);
                  setEqaimeRefInput("");
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={eqaimeBusy || !eqaimeRefInput.trim()}
                onClick={() => void saveEqaimeRef()}
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#D5DADF] bg-white p-4 shadow-lg">
            <h3 className="m-0 text-lg font-semibold text-[#34495E]">
              {t("networkInbox.rejectTitle", { defaultValue: "Rədd səbəbi" })}
            </h3>
            <textarea
              className="mt-3 min-h-[5rem] w-full rounded-lg border border-[#D5DADF] p-2 text-[13px] text-[#34495E]"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setRejectId(null)}>
                {t("common.cancel")}
              </button>
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void submitReject()}>
                {t("networkInbox.reject", { defaultValue: "Rədd et" })}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
