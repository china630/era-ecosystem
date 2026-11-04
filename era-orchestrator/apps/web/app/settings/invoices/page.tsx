"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  labelSatelliteKey,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useAuth } from "../../../lib/auth-context";
import { orchFetch } from "../../../lib/orch-api";

type InvoiceLine = {
  organizationId: string;
  organizationName: string;
  organizationTaxId?: string;
  parentOrganizationId?: string | null;
  satelliteKey?: string | null;
  outletCode?: string | null;
  catalogKind?: string | null;
  moduleKey?: string | null;
  meterKey?: string | null;
  period?: string | null;
  ratingBasis?: string | null;
  description: string;
  amount: string;
};

type InvoiceRow = {
  id: string;
  amount?: string | number;
  status?: string;
  date?: string;
  billingPeriod?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  lines?: InvoiceLine[];
};

function sumAmounts(lines: InvoiceLine[]): number {
  return lines.reduce((acc, l) => acc + Number(l.amount || 0), 0);
}

function formatAzn(n: number): string {
  return `${n.toFixed(2)} AZN`;
}

export default function InvoicesPage() {
  const { ready } = useRequireAuth();
  const { token } = useAuth();
  const t = useTranslations("settings.invoices");
  const [items, setItems] = useState<InvoiceRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const pageSize = 20;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const res = await orchFetch(
      `/v1/billing/invoices?page=${page}&pageSize=${pageSize}`,
      { token },
    );
    if (!res.ok) {
      setError(t("loadFailed"));
      setItems([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as {
      items?: InvoiceRow[];
      total?: number;
    };
    setItems(data.items ?? []);
    setTotal(data.total ?? (data.items?.length ?? 0));
    setLoading(false);
  }, [token, page, t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function downloadPdf(id: string) {
    if (!token) return;
    const res = await orchFetch(`/v1/billing/invoices/${id}/pdf`, { token });
    if (!res.ok) {
      setError(t("pdfFailed"));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscription-invoice-${id.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const trees = useMemo(() => {
    return items.map((inv) => {
      const lines = inv.lines ?? [];
      const byOrg = new Map<string, InvoiceLine[]>();
      for (const line of lines) {
        const key = line.organizationId;
        const arr = byOrg.get(key) ?? [];
        arr.push(line);
        byOrg.set(key, arr);
      }
      const orgNodes = [...byOrg.entries()].map(([orgId, orgLines]) => {
        const orgName = orgLines[0]?.organizationName ?? orgId.slice(0, 8);
        const bySat = new Map<string, InvoiceLine[]>();
        for (const line of orgLines) {
          const sat = line.satelliteKey?.trim() || "—";
          const arr = bySat.get(sat) ?? [];
          arr.push(line);
          bySat.set(sat, arr);
        }
        const satNodes = [...bySat.entries()].map(([sat, satLines]) => {
          const byOutlet = new Map<string, InvoiceLine[]>();
          for (const line of satLines) {
            const out = line.outletCode?.trim() || "—";
            const arr = byOutlet.get(out) ?? [];
            arr.push(line);
            byOutlet.set(out, arr);
          }
          return {
            sat,
            total: sumAmounts(satLines),
            outlets: [...byOutlet.entries()].map(([outlet, outletLines]) => ({
              outlet,
              total: sumAmounts(outletLines),
              lines: outletLines,
            })),
          };
        });
        return {
          orgId,
          orgName,
          total: sumAmounts(orgLines),
          sats: satNodes,
        };
      });
      return { inv, orgNodes };
    });
  }, [items]);

  if (!ready) return null;

  return (
    <div className="space-y-4">
      <Link href="/settings/subscription" className={SECONDARY_BUTTON_CLASS}>
        ← {t("back")}
      </Link>
      <h1 className="text-xl font-semibold text-[#34495E]">{t("title")}</h1>
      <p className="text-sm text-[#7F8C8D]">{t("hint")}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}
      <div className={CARD_CONTAINER_CLASS}>
        <ul className="divide-y divide-[#EBEDF0]">
          {trees.map(({ inv, orgNodes }) => {
            const open = expanded[inv.id] === true;
            return (
              <li key={inv.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [inv.id]: !open }))
                    }
                  >
                    <p className="font-medium text-[#34495E]">
                      {open ? "▼" : "▶"}{" "}
                      {inv.billingPeriod ?? inv.date ?? inv.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-[#7F8C8D]">
                      {inv.status ?? "—"} · {String(inv.amount ?? "—")} AZN
                    </p>
                  </button>
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    onClick={() => void downloadPdf(inv.id)}
                  >
                    {t("downloadPdf")}
                  </button>
                </div>
                {open ? (
                  <div className="mt-3 space-y-3 rounded-lg border border-[#EBEDF0] bg-[#FAFBFC] p-3 text-xs text-[#5D6D7E]">
                    {orgNodes.length === 0 ? (
                      <p>{t("noLines")}</p>
                    ) : (
                      orgNodes.map((org) => (
                        <div
                          key={org.orgId}
                          className="space-y-2 rounded-md border border-[#EBEDF0] bg-white p-2.5"
                        >
                          <p className="text-sm font-semibold text-[#34495E]">
                            {org.orgName}
                            <span className="ml-2 font-normal text-[#7F8C8D]">
                              {formatAzn(org.total)}
                            </span>
                          </p>
                          {org.sats.map((sat) => (
                            <div key={sat.sat} className="ml-1 space-y-1.5 border-l-2 border-[#D5DADF] pl-3">
                              <p className="font-medium text-[#475569]">
                                {t("satNode", {
                                  sat:
                                    sat.sat === "—"
                                      ? sat.sat
                                      : labelSatelliteKey(sat.sat),
                                  total: formatAzn(sat.total),
                                })}
                              </p>
                              {sat.outlets.map((out) => (
                                <div key={out.outlet} className="ml-1 space-y-1">
                                  <p className="text-[#5D6D7E]">
                                    {t("outletNode", {
                                      outlet: out.outlet,
                                      total: formatAzn(out.total),
                                    })}
                                  </p>
                                  <ul className="space-y-0.5 pl-2">
                                    {out.lines.map((line, idx) => (
                                      <li
                                        key={`${line.description}-${idx}`}
                                        className="flex flex-wrap justify-between gap-2 text-[#7F8C8D]"
                                      >
                                        <span>
                                          {line.description}
                                          {line.ratingBasis
                                            ? ` · ${line.ratingBasis}`
                                            : ""}
                                          {line.moduleKey
                                            ? ` · ${line.moduleKey}`
                                            : ""}
                                        </span>
                                        <span className="tabular-nums text-[#34495E]">
                                          {line.amount} AZN
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
          {!loading && items.length === 0 ? (
            <li className="p-4 text-sm text-[#7F8C8D]">{t("empty")}</li>
          ) : null}
        </ul>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          {t("prev")}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={page * pageSize >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          {t("next")}
        </button>
      </div>
    </div>
  );
}
