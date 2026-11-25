"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  Field,
  FORM_STACK_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  VoenLookupField,
} from "@era/satellite-kit/ui";
import { apiJson } from "@/lib/client-api";
import { claimStatusOptions } from "@/lib/claim-status";

type Claim = {
  id: string;
  subcontractorName: string;
  amountNet: string | number;
  status: string;
  notes: string | null;
};

const claimFormId = "project-claim-form";

export function ProjectClaimsOps({ projectId }: { projectId: string }) {
  const t = useTranslations("projectsDetail");
  const tc = useTranslations("common");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [subName, setSubName] = useState("");
  const [subVoen, setSubVoen] = useState("");
  const [subAmount, setSubAmount] = useState("1000");

  const load = useCallback(async () => {
    const res = await apiJson<Claim[]>(`/api/projects/${projectId}/subcontractor-claims`);
    if (!res.ok) {
      setMessage(res.error);
      setClaims([]);
      return;
    }
    setClaims(Array.isArray(res.data) ? res.data : []);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(claimId: string, status: string) {
    setBusy(true);
    const res = await apiJson(`/api/projects/${projectId}/subcontractor-claims`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimId, status }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold">{t("subcontractorClaim")}</h2>
          <p className="text-[12px] text-[#7F8C8D]">{t("claimsSubtitle")}</p>
        </div>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
          {t("saveClaim")}
        </button>
      </div>
      {message ? <p className="text-[13px]">{message}</p> : null}
      {claims.length === 0 ? (
        <p className="text-[12px] text-[#7F8C8D]">{t("claimsEmpty")}</p>
      ) : (
        <ul className="space-y-2 text-[13px]">
          {claims.map((c) => (
            <li key={c.id} className="flex flex-wrap items-end justify-between gap-2 border-b py-1">
              <span>
                {c.subcontractorName} · {Number(c.amountNet).toFixed(2)} AZN
                {c.notes ? ` · ${c.notes}` : ""}
              </span>
              <CatalogField
                kind="CLOSED_SMALL"
                label={tc("status")}
                value={c.status}
                onChange={(v) => {
                  const next = String(v);
                  if (next === c.status) return;
                  void updateStatus(c.id, next);
                }}
                options={claimStatusOptions(c.status)}
                hideLabel
              />
            </li>
          ))}
        </ul>
      )}

      <ModalShell
        open={modalOpen}
        title={t("subcontractorClaim")}
        onClose={() => setModalOpen(false)}
        closeLabel={tc("cancel")}
        footer={
          <ModalFooter
            formId={claimFormId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel={t("saveClaim")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <form
          id={claimFormId}
          className={FORM_STACK_CLASS}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            const amountNet = Number(subAmount);
            if (!(amountNet > 0)) {
              setBusy(false);
              setMessage(t("claimAmountPositive"));
              return;
            }
            const res = await apiJson(`/api/projects/${projectId}/subcontractor-claims`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subcontractorName: subName || subVoen,
                amountNet,
                voen: subVoen || undefined,
              }),
            });
            setBusy(false);
            if (!res.ok) {
              setMessage(res.error);
              return;
            }
            setMessage(t("claimSaved"));
            setModalOpen(false);
            setSubName("");
            setSubVoen("");
            setSubAmount("1000");
            await load();
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
          <Field
            label={t("subName")}
            preset="shortText"
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
          />
          <Field
            label={t("claimAmount")}
            preset="amount"
            value={subAmount}
            onChange={(e) => setSubAmount(e.target.value)}
          />
        </form>
      </ModalShell>
    </div>
  );
}
