"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, CatalogField, PRIMARY_BUTTON_CLASS, PageHeader } from "@era/satellite-kit/ui";
import { ProjectHub, type ProjectHubTab } from "@/components/ProjectHub";
import { apiJson } from "@/lib/client-api";
import { requisitionStatusOptions } from "@/lib/requisition-status";

type PlanLine = {
  itemCode: string;
  description: string;
  plannedQty: number;
  requisitionQty: number;
  actualQty?: number;
  actualAmountNet?: number;
  varianceQty: number;
  plannedAmountNet: number;
};

type PlanVsActual = {
  projectCode: string;
  projectName: string;
  lines: PlanLine[];
  totals: {
    plannedAmountNet: number;
    progressApprovedNet: number;
    varianceAmountNet: number;
  };
};

type Requisition = {
  id: string;
  itemCode: string;
  description: string;
  qty: string | number;
  status: string;
};

export default function ProjectDetailPage() {
  const t = useTranslations("projectsDetail");
  const tc = useTranslations("common");
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [plan, setPlan] = useState<PlanVsActual | null>(null);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ProjectHubTab>("overview");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [planRes, reqRes] = await Promise.all([
      apiJson<PlanVsActual>(`/api/projects/${id}/plan-vs-actual`),
      apiJson<Requisition[] | { data?: Requisition[] }>("/api/material-requisitions"),
    ]);
    if (!planRes.ok) {
      setMessage(planRes.error || t("loadFailed"));
      setPlan(null);
    } else {
      setPlan(planRes.data);
      setMessage("");
    }
    if (reqRes.ok) {
      const raw = reqRes.data;
      const allReqs = Array.isArray(raw) ? raw : raw.data ?? [];
      setRequisitions(
        allReqs.filter((r: { project?: { id: string } }) => (r as { project?: { id: string } }).project?.id === id),
      );
    }
    setLoading(false);
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateRequisitionStatus(requisitionId: string, status: string) {
    const res = await apiJson("/api/material-requisitions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requisitionId, status }),
    });
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    await load();
  }

  const overview = plan ? (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded border p-3 text-[13px]">
          <div className="text-[#7F8C8D]">{t("plannedBoq")}</div>
          <div className="text-lg font-semibold">{plan.totals.plannedAmountNet.toFixed(2)} AZN</div>
        </div>
        <div className="rounded border p-3 text-[13px]">
          <div className="text-[#7F8C8D]">{t("approvedProgress")}</div>
          <div className="text-lg font-semibold">{plan.totals.progressApprovedNet.toFixed(2)} AZN</div>
        </div>
        <div className="rounded border p-3 text-[13px]">
          <div className="text-[#7F8C8D]">{t("variance")}</div>
          <div className="text-lg font-semibold">{plan.totals.varianceAmountNet.toFixed(2)} AZN</div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-[13px] font-semibold">{t("planVsActual")}</h2>
        {plan.lines.length === 0 ? (
          <p className="text-[12px] text-[#7F8C8D]">{t("planEmpty")}</p>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b text-[#7F8C8D]">
                <th className="py-2">{t("item")}</th>
                <th>{t("plannedQty")}</th>
                <th>{t("actualQty")}</th>
                <th>{t("requisitionQty")}</th>
                <th>{t("variance")}</th>
              </tr>
            </thead>
            <tbody>
              {plan.lines.map((line) => (
                <tr key={line.itemCode} className="border-b">
                  <td className="py-2">
                    {line.itemCode} — {line.description}
                  </td>
                  <td>{line.plannedQty}</td>
                  <td>{line.actualQty ?? 0}</td>
                  <td>{line.requisitionQty}</td>
                  <td>{line.varianceQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-[13px] font-semibold">{t("materialRequisitions")}</h2>
        {requisitions.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">{t("noRequisitions")}</p>
        ) : (
          <ul className="space-y-2 text-[13px]">
            {requisitions.map((r) => (
              <li key={r.id} className="flex flex-wrap items-end justify-between gap-2 rounded border p-2">
                <span>
                  {r.itemCode} — {r.description}: {Number(r.qty)}
                </span>
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={tc("status")}
                  value={r.status}
                  onChange={(v) => {
                    const next = String(v);
                    if (next === r.status) return;
                    void updateRequisitionStatus(r.id, next);
                  }}
                  options={requisitionStatusOptions(r.status)}
                  hideLabel
                />
              </li>
            ))}
          </ul>
        )}
        <Link href="/material-requisitions" className="mt-2 inline-block text-[12px] text-[#2980B9] hover:underline">
          {t("requisitions")} →
        </Link>
      </div>
    </div>
  ) : null;

  return (
    <>
      <PageHeader
        title={plan?.projectName ?? t("project")}
        subtitle={plan?.projectCode ?? id}
        actions={
          <div className="flex gap-2">
            <Link href="/field-ops" className={PRIMARY_BUTTON_CLASS}>
              {t("fieldOpsLink")}
            </Link>
            <Link href="/material-requisitions" className={PRIMARY_BUTTON_CLASS}>
              {t("requisitions")}
            </Link>
            <Link href="/projects" className={PRIMARY_BUTTON_CLASS}>
              {t("projects")}
            </Link>
          </div>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} space-y-6 p-6`}>
        {loading ? (
          <p className="text-[13px] text-[#7F8C8D]">{tc("loading")}</p>
        ) : !plan ? (
          <p className="text-[13px] text-red-600">{message || tc("notFound")}</p>
        ) : (
          <>
            {message ? <p className="text-[13px]">{message}</p> : null}
            <ProjectHub
              projectId={id}
              tab={tab}
              onTabChange={setTab}
              overview={overview}
              onOpsChanged={() => void load()}
            />
          </>
        )}
      </div>
    </>
  );
}
