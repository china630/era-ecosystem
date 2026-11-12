"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  CARD_CONTAINER_CLASS,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import { useAuth } from "../../../../lib/auth-context";
import { getOrchAccessToken, orchFetch } from "../../../../lib/orch-api";
import { DocumentsNav } from "../../../../components/documents/documents-nav";
import { RouteCanvas } from "../../../../components/documents/route-canvas";

const STEP_KINDS = [
  "REQUESTER_MANAGER",
  "ORG_UNIT_HEAD",
  "POSITION_IN_UNIT",
  "MANAGER_CHAIN",
  "POSITION_HOLDER",
  "MATRIX_MANAGER",
  "GRADE_AT_LEAST",
];
const ACTIONS = ["APPROVE", "SIGN", "EXECUTE", "ACKNOWLEDGE"];
const KINDS = ["", "INCOMING", "OUTGOING", "INTERNAL"];

type StepDraft = {
  kind: string;
  action: string;
  join: string;
  dueDays: string;
  orgUnitId: string;
  positionId: string;
  skipUnlessKind: string;
  minAmount: string;
  layoutX: number | null;
  layoutY: number | null;
};

type Template = {
  id: string;
  name: string;
  docKind: string;
  steps: Array<{
    stepOrder: number;
    kind: string;
    action: string;
    join?: string;
    dueDays?: number;
    orgUnitId?: string | null;
    positionId?: string | null;
    layoutX: number | null;
    layoutY: number | null;
    skipUnlessKind: string | null;
    minAmount: string | null;
  }>;
  edges: Array<{ fromStepOrder: number | null; toStepOrder: number }>;
};

const blankStep = (): StepDraft => ({
  kind: "ORG_UNIT_HEAD",
  action: "APPROVE",
  join: "ANY",
  dueDays: "3",
  orgUnitId: "",
  positionId: "",
  skipUnlessKind: "",
  minAmount: "",
  layoutX: null,
  layoutY: null,
});

export default function DocumentRoutesPage() {
  const { ready } = useRequireAuth();
  const { token } = useAuth();
  const t = useTranslations("documentsOffice");
  const [rows, setRows] = useState<Template[]>([]);
  const [lookup, setLookup] = useState<{ orgUnits: Array<{ id: string; name: string }>; positions: Array<{ id: string; name: string }> }>({ orgUnits: [], positions: [] });
  const [name, setName] = useState("");
  const [docKind, setDocKind] = useState("INCOMING");
  const [steps, setSteps] = useState<StepDraft[]>([blankStep()]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const tokenValue = getOrchAccessToken() ?? token;
    if (!tokenValue) return;
    const [tplRes, lookRes] = await Promise.all([
      orchFetch("/v1/documents/templates", { token: tokenValue }),
      orchFetch("/v1/documents/lookups", { token: tokenValue }),
    ]);
    if (tplRes.ok) setRows((await tplRes.json()) as Template[]);
    else setError(t("loadFailed"));
    if (lookRes.ok) setLookup(await lookRes.json());
  }, [token, t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  function patchStep(index: number, patch: Partial<StepDraft>) {
    setSteps((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const tokenValue = getOrchAccessToken() ?? token;
    if (!tokenValue || !name.trim()) return;
    const res = await orchFetch(editingId ? `/v1/documents/templates/${editingId}` : "/v1/documents/templates", {
      token: tokenValue,
      method: editingId ? "PATCH" : "POST",
      body: JSON.stringify({
        name: name.trim(),
        docKind,
        steps: steps.map((step, index) => ({
          stepOrder: index + 1,
          kind: step.kind,
          action: step.action,
          join: step.join,
          dueDays: Number(step.dueDays) || 3,
          orgUnitId: step.orgUnitId || undefined,
          positionId: step.positionId || undefined,
          skipUnlessKind: step.skipUnlessKind || undefined,
          minAmount: step.minAmount === "" ? undefined : Number(step.minAmount),
          layoutX: step.layoutX ?? undefined,
          layoutY: step.layoutY ?? undefined,
        })),
      }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { code?: string; message?: { code?: string } } | null;
      setError(payload?.code ?? payload?.message?.code ?? t("saveFailed"));
      return;
    }
    setName("");
    setSteps([blankStep()]);
    setEditingId(null);
    await load();
  }

  if (!ready) return null;
  const kindOptions = ["INCOMING", "OUTGOING", "INTERNAL"].map((value) => ({ value, label: t(`kind_${value}`) }));
  return (
    <div className="space-y-4 p-4">
      <PageHeader title={t("routesTitle")} subtitle={t("routesSubtitle")} />
      <DocumentsNav />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <form onSubmit={onCreate} className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
        <Field preset="shortText" label={t("fieldTemplateName")} value={name} onChange={(e) => setName(e.target.value)} />
        <CatalogField kind="CLOSED_SMALL" label={t("fieldKind")} value={docKind} onChange={(v) => setDocKind(String(v))} options={kindOptions} />
        {steps.map((step, index) => (
          <div key={index} className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("step")} {index + 1}</span>
              {steps.length > 1 ? (
                <button className={SECONDARY_BUTTON_CLASS} type="button" onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}>
                  {t("removeStep")}
                </button>
              ) : null}
            </div>
            <CatalogField kind="CLOSED_SMALL" label={t("fieldStepKind")} value={step.kind} onChange={(v) => patchStep(index, { kind: String(v) })} options={STEP_KINDS.map((value) => ({ value, label: t(`stepKind_${value}`) }))} />
            <CatalogField kind="CLOSED_SMALL" label={t("fieldAction")} value={step.action} onChange={(v) => patchStep(index, { action: String(v) })} options={ACTIONS.map((value) => ({ value, label: t(`action_${value}`) }))} />
            <CatalogField kind="CLOSED_SMALL" label={t("fieldJoin")} value={step.join} onChange={(v) => patchStep(index, { join: String(v) })} options={[{ value: "ANY", label: t("joinAny") }, { value: "ALL", label: t("joinAll") }]} />
            <Field preset="shortText" label={t("fieldDueDays")} value={step.dueDays} onChange={(e) => patchStep(index, { dueDays: e.target.value })} />
            <CatalogField kind="SEARCHABLE" label={t("fieldOrgUnit")} value={step.orgUnitId} onChange={(v) => patchStep(index, { orgUnitId: String(v) })} options={lookup.orgUnits.map((row) => ({ value: row.id, label: row.name }))} />
            <CatalogField kind="SEARCHABLE" label={t("fieldPosition")} value={step.positionId} onChange={(v) => patchStep(index, { positionId: String(v) })} options={lookup.positions.map((row) => ({ value: row.id, label: row.name }))} />
            <CatalogField kind="CLOSED_SMALL" label={t("fieldSkipKind")} value={step.skipUnlessKind} onChange={(v) => patchStep(index, { skipUnlessKind: String(v) })} options={KINDS.map((value) => ({ value, label: value ? t(`kind_${value}`) : t("skipNone") }))} />
            <Field preset="shortText" label={t("fieldMinAmount")} value={step.minAmount} onChange={(e) => patchStep(index, { minAmount: e.target.value })} />
          </div>
        ))}
        <button className={SECONDARY_BUTTON_CLASS} type="button" onClick={() => setSteps((current) => [...current, blankStep()])}>{t("addStep")}</button>
        <button className={PRIMARY_BUTTON_CLASS} type="submit">{editingId ? t("saveTemplate") : t("createTemplate")}</button>
        <p className="text-sm text-slate-600">{t("canvasHint")}</p>
        <RouteCanvas
          editable
          steps={steps.map((step, index) => ({
            stepOrder: index + 1,
            label: `${index + 1}. ${t(`action_${step.action}`)}`,
            detail: `${t(`stepKind_${step.kind}`)} · ${t(step.join === "ALL" ? "joinAll" : "joinAny")}`,
            layoutX: step.layoutX,
            layoutY: step.layoutY,
          }))}
          edges={steps.map((_, index) => ({
            fromStepOrder: index === 0 ? null : index,
            toStepOrder: index + 1,
          }))}
          onMove={(order, x, y) => patchStep(order - 1, { layoutX: x, layoutY: y })}
        />
      </form>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className={`${CARD_CONTAINER_CLASS} p-4 text-sm`}>
            <div className="flex items-center justify-between gap-2">
              <span>{row.name} · {t(`kind_${row.docKind}`)}</span>
              <button className={SECONDARY_BUTTON_CLASS} type="button" onClick={() => {
                setEditingId(row.id);
                setName(row.name);
                setDocKind(row.docKind);
                setSteps(row.steps.map((step) => ({
                  kind: step.kind,
                  action: step.action,
                  join: step.join ?? "ANY",
                  dueDays: String(step.dueDays ?? 3),
                  orgUnitId: step.orgUnitId ?? "",
                  positionId: step.positionId ?? "",
                  skipUnlessKind: step.skipUnlessKind ?? "",
                  minAmount: step.minAmount ?? "",
                  layoutX: step.layoutX,
                  layoutY: step.layoutY,
                })));
              }}>{t("editTemplate")}</button>
              <button className={SECONDARY_BUTTON_CLASS} type="button" onClick={async () => {
                const tokenValue = getOrchAccessToken() ?? token;
                if (!tokenValue) return;
                await orchFetch(`/v1/documents/templates/${row.id}`, { token: tokenValue, method: "DELETE" });
                await load();
              }}>{t("delete")}</button>
            </div>
            <ol className="mt-2 list-decimal pl-5">
              {row.steps.map((step) => (
                <li key={step.stepOrder}>{t(`action_${step.action}`)} · {t(`stepKind_${step.kind}`)} · {t(step.join === "ALL" ? "joinAll" : "joinAny")}</li>
              ))}
            </ol>
            <div className="mt-3">
              <RouteCanvas
                editable
                steps={row.steps.map((step) => ({
                  stepOrder: step.stepOrder,
                  label: `${step.stepOrder}. ${t(`action_${step.action}`)}`,
                  detail: t(step.join === "ALL" ? "joinAll" : "joinAny"),
                  layoutX: step.layoutX,
                  layoutY: step.layoutY,
                }))}
                edges={(row.edges ?? []).length > 0 ? row.edges : row.steps.map((step, index) => ({
                  fromStepOrder: index === 0 ? null : row.steps[index - 1]!.stepOrder,
                  toStepOrder: step.stepOrder,
                }))}
                onMove={async (order, x, y) => {
                  const tokenValue = getOrchAccessToken() ?? token;
                  if (!tokenValue) return;
                  await orchFetch(`/v1/documents/templates/${row.id}/layout`, {
                    token: tokenValue,
                    method: "PATCH",
                    body: JSON.stringify({ steps: [{ stepOrder: order, layoutX: x, layoutY: y }] }),
                  });
                  await load();
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
