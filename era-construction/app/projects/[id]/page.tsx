"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  VoenLookupField,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type PlanLine = {
  itemCode: string;
  description: string;
  plannedQty: number;
  requisitionQty: number;
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

const subcontractorClaimFormId = "construction-subcontractor-claim-form";

export default function ProjectDetailPage() {
  const t = useTranslations("projectsDetail");
  const tc = useTranslations("common");
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [plan, setPlan] = useState<PlanVsActual | null>(null);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [subName, setSubName] = useState("");
  const [subVoen, setSubVoen] = useState("");
  const [subAmount, setSubAmount] = useState("1000");
  const [claimModalOpen, setClaimModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [planRes, reqRes] = await Promise.all([
      fetch(`/api/projects/${id}/plan-vs-actual`),
      fetch("/api/material-requisitions"),
    ]);
    const planData = await planRes.json();
    const reqData = await reqRes.json();
    if (!planRes.ok) {
      setMessage(planData.error ?? t("loadFailed"));
      setPlan(null);
    } else {
      setPlan(planData);
    }
    const allReqs = Array.isArray(reqData) ? reqData : reqData.data ?? [];
    setRequisitions(
      allReqs.filter((r: { project?: { id: string } }) => r.project?.id === id),
    );
    setLoading(false);
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title={plan?.projectName ?? t("project")}
        subtitle={plan?.projectCode ?? id}
        actions={
          <div className="flex gap-2">
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
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded border p-3 text-[13px]">
                <div className="text-[#7F8C8D]">{t("plannedBoq")}</div>
                <div className="text-lg font-semibold">
                  {plan.totals.plannedAmountNet.toFixed(2)} AZN
                </div>
              </div>
              <div className="rounded border p-3 text-[13px]">
                <div className="text-[#7F8C8D]">{t("approvedProgress")}</div>
                <div className="text-lg font-semibold">
                  {plan.totals.progressApprovedNet.toFixed(2)} AZN
                </div>
              </div>
              <div className="rounded border p-3 text-[13px]">
                <div className="text-[#7F8C8D]">{t("variance")}</div>
                <div className="text-lg font-semibold">
                  {plan.totals.varianceAmountNet.toFixed(2)} AZN
                </div>
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-[13px] font-semibold">{t("planVsActual")}</h2>
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b text-[#7F8C8D]">
                    <th className="py-2">{t("item")}</th>
                    <th>{t("plannedQty")}</th>
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
                      <td>{line.requisitionQty}</td>
                      <td>{line.varianceQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h2 className="mb-2 text-[13px] font-semibold">{t("materialRequisitions")}</h2>
              {requisitions.length === 0 ? (
                <p className="text-[13px] text-[#7F8C8D]">{t("noRequisitions")}</p>
              ) : (
                <ul className="space-y-2 text-[13px]">
                  {requisitions.map((r) => (
                    <li key={r.id} className="rounded border p-2">
                      {r.itemCode} — {r.description}: {Number(r.qty)} ({r.status})
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded border p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[13px] font-semibold">{t("subcontractorClaim")}</h2>
                <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setClaimModalOpen(true)}>
                  {t("saveClaim")}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      <ModalShell
        open={claimModalOpen}
        title={t("subcontractorClaim")}
        onClose={() => setClaimModalOpen(false)}
        closeLabel={tc("cancel")}
        footer={
          <ModalFooter
            formId={subcontractorClaimFormId}
            onCancel={() => setClaimModalOpen(false)}
            busy={loading}
            submitLabel={t("saveClaim")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <form
          id={subcontractorClaimFormId}
          className={FORM_STACK_CLASS}
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await fetch(`/api/projects/${id}/subcontractor-claims`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subcontractorName: subName || subVoen,
                amountNet: Number(subAmount) || 0,
                voen: subVoen || undefined,
              }),
            });
            const data = await res.json();
            if (res.ok) {
              setMessage(t("claimSaved"));
              setClaimModalOpen(false);
              setSubName("");
              setSubVoen("");
              setSubAmount("1000");
            } else {
              setMessage(data.error ?? tc("error"));
            }
          }}
        >
          <VoenLookupField
            value={subVoen}
            onChange={setSubVoen}
            onResolved={(r) => {
              if (r.found && r.name) setSubName(r.name);
            }}
            labels={{
              voen: t("subVoen"),
              check: tc("check"),
              found: tc("found"),
              notFound: tc("notFound"),
              invalid: tc("invalid"),
            }}
          />
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("subName")}</label>
            <input className={MODAL_INPUT_CLASS} value={subName} onChange={(e) => setSubName(e.target.value)} />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("claimAmount")}</label>
            <input className={MODAL_INPUT_CLASS} value={subAmount} onChange={(e) => setSubAmount(e.target.value)} inputMode="decimal" />
          </div>
        </form>
      </ModalShell>
    </>
  );
}
