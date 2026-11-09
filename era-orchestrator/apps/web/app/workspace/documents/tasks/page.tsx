"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  Field,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import { useAuth } from "../../../../lib/auth-context";
import { getOrchAccessToken, orchFetch } from "../../../../lib/orch-api";
import { DocumentsNav } from "../../../../components/documents/documents-nav";

type TaskRow = {
  id: string;
  action: string;
  stepOrder: number;
  dueAt: string | null;
  instance: {
    currentStep: number;
    case: { id: string; title: string; regNumber: string | null };
    template: { steps: Array<{ stepOrder: number }> };
  };
};

export default function DocumentTasksPage() {
  const { ready } = useRequireAuth();
  const { token } = useAuth();
  const t = useTranslations("documentsOffice");
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [reason, setReason] = useState("");
  const [returnStep, setReturnStep] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const tokenValue = getOrchAccessToken() ?? token;
    if (!tokenValue) return;
    const res = await orchFetch("/v1/documents/tasks/mine", { token: tokenValue });
    if (!res.ok) {
      setError(t("loadFailed"));
      return;
    }
    setRows((await res.json()) as TaskRow[]);
  }, [token, t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function decide(e: FormEvent, taskId: string, outcome: "APPROVED" | "REJECTED" | "ACKNOWLEDGED") {
    e.preventDefault();
    const tokenValue = getOrchAccessToken() ?? token;
    if (!tokenValue) return;
    setError(null);
    const back = returnStep[taskId];
    const res = await orchFetch(`/v1/documents/tasks/${taskId}/decide`, {
      token: tokenValue,
      method: "POST",
      body: JSON.stringify({
        outcome,
        reason: reason.trim() || undefined,
        returnToStep: outcome === "REJECTED" && back ? Number(back) : undefined,
      }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { code?: string; message?: string | { code?: string } } | null;
      const nested = payload?.message && typeof payload.message === "object" ? payload.message.code : undefined;
      setError(payload?.code ?? nested ?? t("saveFailed"));
      return;
    }
    setReason("");
    await load();
  }

  if (!ready) return null;
  const now = Date.now();
  const visible = rows
    .filter((row) => !overdueOnly || (row.dueAt != null && new Date(row.dueAt).getTime() < now))
    .slice()
    .sort((a, b) => {
      const aLate = a.dueAt != null && new Date(a.dueAt).getTime() < now ? 0 : 1;
      const bLate = b.dueAt != null && new Date(b.dueAt).getTime() < now ? 0 : 1;
      return aLate - bLate;
    });
  return (
    <div className="space-y-4 p-4">
      <PageHeader title={t("tasksTitle")} subtitle={t("tasksSubtitle")} />
      <DocumentsNav />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button className={SECONDARY_BUTTON_CLASS} type="button" onClick={() => setOverdueOnly((value) => !value)}>
        {overdueOnly ? t("filterAllTasks") : t("filterOverdue")}
      </button>
      {visible.length === 0 ? <p>{t("tasksEmpty")}</p> : null}
      {visible.map((row) => {
        const late = row.dueAt != null && new Date(row.dueAt).getTime() < now;
        return (
        <form key={row.id} className={`${CARD_CONTAINER_CLASS} space-y-2 p-4`} onSubmit={(e) => decide(e, row.id, row.action === "ACKNOWLEDGE" ? "ACKNOWLEDGED" : "APPROVED")}>
          <p className="font-medium">
            <Link className="underline" href={`/workspace/documents/${row.instance.case.id}`}>
              {row.instance.case.regNumber ?? row.instance.case.title}
            </Link>
          </p>
          <p className="text-sm">{t(`action_${row.action}`)} {late ? <span className="text-red-600">{t("overdue")}</span> : null}</p>
          <Field preset="longText" label={t("fieldReason")} value={reason} onChange={(e) => setReason(e.target.value)} />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("fieldReturnStep")}
            value={returnStep[row.id] ?? ""}
            onChange={(v) => setReturnStep((current) => ({ ...current, [row.id]: String(v) }))}
            options={[
              { value: "", label: t("returnToAuthor") },
              ...row.instance.template.steps
                .filter((step) => step.stepOrder < row.stepOrder)
                .map((step) => ({ value: String(step.stepOrder), label: `${t("step")} ${step.stepOrder}` })),
            ]}
          />
          <div className="flex gap-2">
            <button className={PRIMARY_BUTTON_CLASS} type="submit">{t("approve")}</button>
            <button className={SECONDARY_BUTTON_CLASS} type="button" onClick={(e) => decide(e as unknown as FormEvent, row.id, "REJECTED")}>
              {t("reject")}
            </button>
          </div>
        </form>
        );
      })}
    </div>
  );
}
