"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Field, ModalShell } from "@era/satellite-kit/ui";
import { DatePicker as FinanceDatePicker } from "../../../components/ui/date-picker";
import { apiFetch } from "../../../lib/api-client";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { Badge } from "../../../components/ui/badge";
import { FinanceEmptyTableRow } from "../../../components/finance-empty-table-row";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";

type SovDraft = {
  key: string;
  code: string;
  description: string;
  amount: string;
  sortOrder: string;
};

type ContractDetail = {
  id: string;
  number: string;
  type: string;
  status: string;
  contractRole?: string;
  currency: string;
  amountLimit?: string | null;
  lines: {
    id: string;
    code?: string | null;
    description?: string | null;
    amount?: string | null;
    sortOrder?: number;
  }[];
  amendments: {
    id: string;
    number: string;
    status: string;
    amountLimitDelta?: string | null;
    sourceType?: string | null;
    sourceId?: string | null;
  }[];
};

function editableStatus(status: string) {
  return status === "DRAFT" || status === "ACTIVE" || status === "SUSPENDED";
}

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [row, setRow] = useState<ContractDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sov, setSov] = useState<SovDraft[]>([]);
  const [amendOpen, setAmendOpen] = useState(false);
  const [amdNumber, setAmdNumber] = useState("");
  const [amdDelta, setAmdDelta] = useState("");
  const [amdDateTo, setAmdDateTo] = useState("");
  const [amdDesc, setAmdDesc] = useState("");

  const load = useCallback(async () => {
    if (!token || !id) return;
    const res = await apiFetch(`/api/contracts/${id}`);
    if (!res.ok) {
      setErr(`${t("contractDetail.loadErr")} (${res.status})`);
      return;
    }
    const data = (await res.json()) as ContractDetail;
    setRow(data);
    setSov(
      (data.lines ?? []).map((l, idx) => ({
        key: l.id,
        code: l.code ?? "",
        description: l.description ?? "",
        amount: l.amount != null ? String(l.amount) : "",
        sortOrder: String(l.sortOrder ?? idx),
      })),
    );
    setErr(null);
  }, [token, id, t]);

  useEffect(() => {
    if (ready && token) void load();
  }, [ready, token, load]);

  const canEdit = useMemo(
    () => (row ? editableStatus(row.status) : false),
    [row],
  );
  const canAmend = row?.status === "ACTIVE";

  async function saveSov() {
    if (!row || !canEdit) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await apiFetch(`/api/contracts/${row.id}/lines`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: sov.map((l, idx) => ({
          code: l.code.trim() || undefined,
          description: l.description.trim() || undefined,
          amount: l.amount.trim() ? Number(l.amount) : undefined,
          sortOrder: l.sortOrder.trim() ? Number(l.sortOrder) : idx,
        })),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(
        `${t("contractDetail.sovSaveErr")} (${res.status}${
          data?.message ? `: ${data.message}` : ""
        })`,
      );
      return;
    }
    setMsg(t("contractDetail.sovSaved"));
    await load();
  }

  async function createAmendment() {
    if (!row || !canAmend || !amdNumber.trim()) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await apiFetch(`/api/contracts/${row.id}/amendments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: amdNumber.trim(),
        amountLimitDelta: amdDelta.trim() ? Number(amdDelta) : undefined,
        dateTo: amdDateTo || undefined,
        description: amdDesc.trim() || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(
        `${t("contractDetail.amendCreateErr")} (${res.status}${
          data?.message ? `: ${data.message}` : data?.code ? `: ${data.code}` : ""
        })`,
      );
      return;
    }
    setAmendOpen(false);
    setAmdNumber("");
    setAmdDelta("");
    setAmdDateTo("");
    setAmdDesc("");
    setMsg(t("contractDetail.amendCreated"));
    await load();
  }

  async function activateAmendment(amendmentId: string) {
    if (!row) return;
    if (!window.confirm(t("contractDetail.amendActivateConfirm"))) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await apiFetch(
      `/api/contracts/${row.id}/amendments/${amendmentId}/activate`,
      { method: "POST" },
    );
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(
        `${t("contractDetail.amendActivateErr")} (${res.status}${
          data?.message ? `: ${data.message}` : data?.code ? `: ${data.code}` : ""
        })`,
      );
      return;
    }
    setMsg(t("contractDetail.amendActivated"));
    await load();
  }

  if (!ready || !token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          row
            ? t("contractDetail.title", { number: row.number })
            : t("contractDetail.titleFallback")
        }
        subtitle={t("contractDetail.subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/pay-applications" className={SECONDARY_BUTTON_CLASS}>
              {t("contractDetail.payAppsLink")}
            </Link>
            <Link href="/contracts" className={SECONDARY_BUTTON_CLASS}>
              {t("contractDetail.back")}
            </Link>
          </div>
        }
      />
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-green-700">{msg}</p> : null}
      {row ? (
        <>
          <p className="text-sm text-gray-700">
            {row.type} · {row.status} · {t("contractDetail.role")}{" "}
            {row.contractRole ?? "PRIME"} · {t("contractDetail.limit")}{" "}
            {row.amountLimit ?? "—"} {row.currency}
          </p>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{t("contractDetail.sovTitle")}</h2>
              {canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() =>
                      setSov((prev) => [
                        ...prev,
                        {
                          key: `new-${Date.now()}`,
                          code: "",
                          description: "",
                          amount: "",
                          sortOrder: String(prev.length),
                        },
                      ])
                    }
                  >
                    {t("contractDetail.addLine")}
                  </button>
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void saveSov()}
                  >
                    {t("contractDetail.saveSov")}
                  </button>
                </div>
              ) : null}
            </div>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("contractDetail.thCode")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("contractDetail.thDesc")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("contractDetail.thAmount")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("contractDetail.thOrder")}</th>
                  {canEdit ? (
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("contractDetail.thActions")}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {sov.length === 0 ? (
                  <FinanceEmptyTableRow
                    colSpan={canEdit ? 5 : 4}
                    message={`${t("contractDetail.sovEmpty")} — ${t("contractDetail.sovSeedHint")}`}
                  />
                ) : (
                  sov.map((l) => (
                    <tr key={l.key} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {canEdit ? (
                          <input
                            className="w-full rounded border px-2 py-1 text-sm"
                            value={l.code}
                            onChange={(e) =>
                              setSov((prev) =>
                                prev.map((x) =>
                                  x.key === l.key ? { ...x, code: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        ) : (
                          l.code || "—"
                        )}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {canEdit ? (
                          <input
                            className="w-full rounded border px-2 py-1 text-sm"
                            value={l.description}
                            onChange={(e) =>
                              setSov((prev) =>
                                prev.map((x) =>
                                  x.key === l.key
                                    ? { ...x, description: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        ) : (
                          l.description || "—"
                        )}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {canEdit ? (
                          <input
                            className="w-28 rounded border px-2 py-1 text-sm"
                            value={l.amount}
                            onChange={(e) =>
                              setSov((prev) =>
                                prev.map((x) =>
                                  x.key === l.key ? { ...x, amount: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        ) : (
                          l.amount || "—"
                        )}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {canEdit ? (
                          <input
                            className="w-16 rounded border px-2 py-1 text-sm"
                            value={l.sortOrder}
                            onChange={(e) =>
                              setSov((prev) =>
                                prev.map((x) =>
                                  x.key === l.key
                                    ? { ...x, sortOrder: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        ) : (
                          l.sortOrder
                        )}
                      </td>
                      {canEdit ? (
                        <td className={DATA_TABLE_TD_CLASS}>
                          <button
                            type="button"
                            className={SECONDARY_BUTTON_CLASS}
                            disabled={busy}
                            onClick={() =>
                              setSov((prev) => prev.filter((x) => x.key !== l.key))
                            }
                          >
                            {t("contractDetail.removeLine")}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{t("contractDetail.amendTitle")}</h2>
              {canAmend ? (
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={() => setAmendOpen(true)}
                >
                  {t("contractDetail.createAmend")}
                </button>
              ) : null}
            </div>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("contractDetail.thNumber")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("contractDetail.thStatus")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("contractDetail.thDelta")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("contractDetail.thSource")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("contractDetail.thActions")}</th>
                </tr>
              </thead>
              <tbody>
                {row.amendments.length === 0 ? (
                  <FinanceEmptyTableRow
                    colSpan={5}
                    message={t("contractDetail.amendEmpty")}
                  />
                ) : (
                  row.amendments.map((a) => (
                    <tr key={a.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{a.number}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <Badge
                          variant={a.status === "ACTIVE" ? "success" : "neutral"}
                        >
                          {a.status}
                        </Badge>
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {a.amountLimitDelta != null ? `Δ ${a.amountLimitDelta}` : "—"}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {a.sourceType
                          ? `${a.sourceType}:${a.sourceId ?? ""}`
                          : "—"}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {a.status === "DRAFT" ? (
                          <button
                            type="button"
                            className={PRIMARY_BUTTON_CLASS}
                            disabled={busy}
                            onClick={() => void activateAmendment(a.id)}
                          >
                            {t("contractDetail.activateAmend")}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
      ) : null}

      {amendOpen ? (
        <ModalShell
          title={t("contractDetail.amendModalTitle")}
          onClose={() => setAmendOpen(false)}
          closeLabel={t("common.close")}
          maxWidthClass="max-w-lg"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setAmendOpen(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy || !amdNumber.trim()}
                onClick={() => void createAmendment()}
              >
                {t("contractDetail.createAmend")}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <Field
              label={t("contractDetail.thNumber")}
              preset="shortText"
              value={amdNumber}
              onChange={(e) => setAmdNumber(e.target.value)}
              required
            />
            <Field
              label={t("contractDetail.thDelta")}
              preset="shortText"
              value={amdDelta}
              onChange={(e) => setAmdDelta(e.target.value)}
            />
            <label className="block">
              <span className="mb-1 block text-sm text-[#7F8C8D]">
                {t("contractDetail.dateTo")}
              </span>
              <FinanceDatePicker
                value={amdDateTo}
                onChange={setAmdDateTo}
                fieldVariant="modal"
              />
            </label>
            <Field
              label={t("contractDetail.thDesc")}
              preset="shortText"
              value={amdDesc}
              onChange={(e) => setAmdDesc(e.target.value)}
            />
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
