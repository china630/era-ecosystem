"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

type DocDetail = {
  id: string;
  kind: string;
  status: string;
  title: string;
  regNumber: string | null;
  summary: string | null;
  amount: string | number | null;
  correspondent: string | null;
  replyTo: { id: string; regNumber: string | null; title: string } | null;
  files: Array<{ id: string; fileName: string; body: string | null }>;
  route: {
    status: string;
    currentStep: number;
    awaitingAssignment: boolean;
    decisions: Array<{ id: string; outcome: string; reason: string | null; stepOrder: number }>;
    tasks: Array<{ id: string; status: string; action: string; stepOrder: number; assigneeEmploymentId: string }>;
  } | null;
  template: {
    id: string;
    name: string;
    edges?: Array<{ fromStepOrder: number | null; toStepOrder: number }>;
    steps: Array<{
      stepOrder: number;
      kind: string;
      action: string;
      join: string;
      skipUnlessKind: string | null;
      minAmount: string | null;
      layoutX: number | null;
      layoutY: number | null;
    }>;
  } | null;
};

type Template = { id: string; name: string; docKind: string };
type Location = { id: string; name: string; kind: string };

export default function DocumentCardPage() {
  const { ready } = useRequireAuth();
  const { token } = useAuth();
  const params = useParams<{ id: string }>();
  const t = useTranslations("documentsOffice");
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileBody, setFileBody] = useState("");
  const [summary, setSummary] = useState("");
  const [replyToId, setReplyToId] = useState("");
  const [links, setLinks] = useState<Array<{ id: string; title: string; regNumber: string | null }>>([]);
  const [fileBodies, setFileBodies] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [employments, setEmployments] = useState<Array<{ id: string; positionName: string; orgUnitName: string }>>([]);
  const [locationId, setLocationId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const access = () => getOrchAccessToken() ?? token;

  const load = useCallback(async () => {
    const tokenValue = access();
    if (!tokenValue || !params.id) return;
    const [docRes, tplRes, locRes, lookRes, linkRes] = await Promise.all([
      orchFetch(`/v1/documents/cases/${params.id}`, { token: tokenValue }),
      orchFetch("/v1/documents/templates", { token: tokenValue }),
      orchFetch("/v1/documents/locations", { token: tokenValue }),
      orchFetch("/v1/documents/lookups", { token: tokenValue }),
      orchFetch("/v1/documents/cases", { token: tokenValue }),
    ]);
    if (!docRes.ok) {
      setError(t("loadFailed"));
      return;
    }
    const data = (await docRes.json()) as DocDetail;
    setDoc(data);
    setSummary(data.summary ?? "");
    setAmount(data.amount == null ? "" : String(data.amount));
    setReplyToId(data.replyTo?.id ?? "");
    setFileBodies(Object.fromEntries(data.files.map((file) => [file.id, file.body ?? ""])));
    setTemplateId(data.template?.id ?? "");
    if (tplRes.ok) setTemplates((await tplRes.json()) as Template[]);
    if (linkRes.ok) setLinks((await linkRes.json()) as Array<{ id: string; title: string; regNumber: string | null }>);
    if (lookRes.ok) {
      const look = (await lookRes.json()) as { employments: Array<{ id: string; positionName: string; orgUnitName: string }> };
      setEmployments(look.employments);
      setAssigneeId((current) => current || look.employments[0]?.id || "");
    }
    if (locRes.ok) {
      const places = (await locRes.json()) as Location[];
      setLocations(places);
      setLocationId((current) => current || places.find((row) => row.kind === "FOLDER")?.id || places[0]?.id || "");
    }
  }, [params.id, token, t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function post(path: string, body?: unknown, method = "POST") {
    const tokenValue = access();
    if (!tokenValue) return;
    setError(null);
    const res = await orchFetch(path, {
      token: tokenValue,
      method,
      body: body ? JSON.stringify(body) : "{}",
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { code?: string; message?: string | { code?: string } } | null;
      const nested = payload?.message && typeof payload.message === "object" ? payload.message.code : undefined;
      setError(payload?.code ?? nested ?? (typeof payload?.message === "string" ? payload.message : undefined) ?? t("saveFailed"));
      return;
    }
    await load();
  }

  async function saveSummary(e: FormEvent) {
    e.preventDefault();
    const tokenValue = access();
    if (!tokenValue || !doc) return;
    const res = await orchFetch(`/v1/documents/cases/${doc.id}`, {
      token: tokenValue,
      method: "PATCH",
      body: JSON.stringify({
        summary,
        templateId: templateId || null,
        amount: amount === "" ? null : Number(amount),
        replyToId: replyToId || null,
      }),
    });
    if (!res.ok) setError(t("saveFailed"));
    else await load();
  }

  async function addFile(e: FormEvent) {
    e.preventDefault();
    if (!doc || !fileName.trim()) return;
    await post(`/v1/documents/cases/${doc.id}/files`, { fileName, body: fileBody });
    setFileName("");
    setFileBody("");
  }

  if (!ready || !doc) return error ? <p className="p-4 text-sm text-red-600">{error}</p> : null;
  const matching = templates.filter((row) => row.docKind === doc.kind);
  const editable = doc.status === "DRAFT" || doc.status === "REGISTERED";

  return (
    <div className="space-y-4 p-4">
      <PageHeader title={doc.regNumber ?? doc.title} subtitle={t(`status_${doc.status}`)} />
      <DocumentsNav />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <p className="font-medium">{doc.title}</p>
        <p className="text-sm">{doc.correspondent}</p>
        <form onSubmit={saveSummary} className="space-y-3">
          <Field preset="longText" label={t("fieldSummary")} value={summary} onChange={(e) => setSummary(e.target.value)} disabled={!editable} />
          <Field preset="shortText" label={t("fieldAmount")} value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!editable} />
          <CatalogField
            kind="SEARCHABLE"
            label={t("fieldReplyTo")}
            value={replyToId}
            onChange={(v) => setReplyToId(String(v))}
            options={links.filter((row) => row.regNumber && row.id !== doc.id).map((row) => ({ value: row.id, label: `${row.regNumber} · ${row.title}` }))}
            disabled={!editable}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("fieldTemplate")}
            value={templateId}
            onChange={(v) => setTemplateId(String(v))}
            options={matching.map((row) => ({ value: row.id, label: row.name }))}
          />
          {editable ? <button className={SECONDARY_BUTTON_CLASS} type="submit">{t("save")}</button> : null}
        </form>
        <div className="flex flex-wrap gap-2">
          {doc.status === "DRAFT" ? (
            <button className={PRIMARY_BUTTON_CLASS} type="button" onClick={() => post(`/v1/documents/cases/${doc.id}/register`)}>
              {t("register")}
            </button>
          ) : null}
          {doc.status === "REGISTERED" ? (
            <button className={PRIMARY_BUTTON_CLASS} type="button" onClick={() => post(`/v1/documents/cases/${doc.id}/start`, { templateId: templateId || undefined })}>
              {t("startRoute")}
            </button>
          ) : null}
          {doc.status === "COMPLETED" || doc.status === "REJECTED" ? (
            <>
              <CatalogField
                kind="SEARCHABLE"
                label={t("fieldParent")}
                value={locationId}
                onChange={(v) => setLocationId(String(v))}
                options={locations.map((row) => ({ value: row.id, label: `${t(`location_${row.kind}`)} · ${row.name}` }))}
              />
              <button className={SECONDARY_BUTTON_CLASS} type="button" onClick={() => post(`/v1/documents/cases/${doc.id}/archive`, { locationId: locationId || undefined })}>
                {t("archive")}
              </button>
            </>
          ) : null}
        </div>
      </section>
      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium">{t("files")}</h2>
        <ul className="text-sm">
        {doc.files.map((file) => (
          <div key={file.id} className="mt-2">
            <p className="font-medium">{file.fileName}</p>
            <Field preset="longText" label={t("fileText")} value={fileBodies[file.id] ?? ""} onChange={(e) => setFileBodies((prev) => ({ ...prev, [file.id]: e.target.value }))} disabled={!editable} />
            {editable ? (
              <button className={SECONDARY_BUTTON_CLASS} type="button" onClick={() => post(`/v1/documents/cases/${doc.id}/files/${file.id}`, { body: fileBodies[file.id] ?? "", fileName: file.fileName }, "PATCH")}>
                {t("replaceFile")}
              </button>
            ) : null}
          </div>
        ))}
        </ul>
        {editable ? (
        <form onSubmit={addFile} className="space-y-2">
          <Field preset="shortText" label={t("fieldFileName")} value={fileName} onChange={(e) => setFileName(e.target.value)} />
          <Field preset="longText" label={t("fieldFileBody")} value={fileBody} onChange={(e) => setFileBody(e.target.value)} />
          <button className={SECONDARY_BUTTON_CLASS} type="submit">{t("addFile")}</button>
        </form>
        ) : null}
      </section>
      <section className={`${CARD_CONTAINER_CLASS} p-4 text-sm`}>
        <h2 className="font-medium">{t("history")}</h2>
        {(doc.route?.decisions ?? []).length === 0 ? <p>{t("noHistory")}</p> : null}
        <ul>
          {(doc.route?.decisions ?? []).map((row) => (
            <li key={row.id}>
              {t("step")} {row.stepOrder}: {t(`outcome_${row.outcome}`)} {row.reason ?? ""}
            </li>
          ))}
        </ul>
        {doc.route?.awaitingAssignment ? (
          <div className="mt-3 space-y-2">
            <p>{t("unassigned")}</p>
            <CatalogField
              kind="SEARCHABLE"
              label={t("fieldAuthor")}
              value={assigneeId}
              onChange={(v) => setAssigneeId(String(v))}
              options={employments.map((row) => ({ value: row.id, label: `${row.positionName} · ${row.orgUnitName}` }))}
            />
            <button className={PRIMARY_BUTTON_CLASS} type="button" onClick={() => post("/v1/documents/tasks/assign", { caseId: doc.id, employmentId: assigneeId })}>
              {t("assign")}
            </button>
          </div>
        ) : null}
        {doc.template ? (
          <>
            <RouteCanvas
              steps={doc.template.steps.map((step) => {
                const decided = (doc.route?.decisions ?? []).some((row) => row.stepOrder === step.stepOrder);
                const current = doc.route?.currentStep === step.stepOrder && doc.route.status === "OPEN";
                const amountN = doc.amount == null || doc.amount === "" ? null : Number(doc.amount);
                const minN = step.minAmount == null || step.minAmount === "" ? null : Number(step.minAmount);
                const skipped =
                  !decided &&
                  !current &&
                  ((step.skipUnlessKind != null && step.skipUnlessKind !== doc.kind) ||
                    (minN != null && (amountN == null || amountN < minN)));
                const rejected = (doc.route?.decisions ?? []).some((row) => row.stepOrder === step.stepOrder && row.outcome === "REJECTED");
                const tone = rejected ? "rejected" : decided ? "done" : current ? "waiting" : skipped ? "skipped" : "pending";
                return {
                  stepOrder: step.stepOrder,
                  label: `${step.stepOrder}. ${t(`action_${step.action}`)}`,
                  detail: current && doc.route?.awaitingAssignment ? t("unassigned") : t(tone === "skipped" ? "stepSkipped" : tone === "done" ? "stepDone" : tone === "waiting" ? "stepWaiting" : tone === "rejected" ? "outcome_REJECTED" : "stepPending"),
                  layoutX: step.layoutX,
                  layoutY: step.layoutY,
                  tone,
                };
              })}
              edges={(doc.template.edges ?? []).length > 0 ? doc.template.edges! : doc.template.steps.map((step, index) => ({
                fromStepOrder: index === 0 ? null : doc.template!.steps[index - 1]!.stepOrder,
                toStepOrder: step.stepOrder,
              }))}
            />
            <ol className="mt-3 list-decimal pl-5">
            {doc.template.steps.map((step) => {
              const decided = (doc.route?.decisions ?? []).some((row) => row.stepOrder === step.stepOrder);
              const current = doc.route?.currentStep === step.stepOrder && doc.route.status === "OPEN";
              const amountN = doc.amount == null || doc.amount === "" ? null : Number(doc.amount);
              const minN = step.minAmount == null || step.minAmount === "" ? null : Number(step.minAmount);
              const skipped =
                !decided &&
                !current &&
                ((step.skipUnlessKind != null && step.skipUnlessKind !== doc.kind) ||
                  (minN != null && (amountN == null || amountN < minN)));
              const label = skipped
                ? t("stepSkipped")
                : decided
                  ? t("stepDone")
                  : current
                    ? doc.route?.awaitingAssignment
                      ? t("unassigned")
                      : t("stepWaiting")
                    : t("stepPending");
              return (
                <li key={step.stepOrder}>
                  {step.stepOrder}. {t(`action_${step.action}`)} · {t(`stepKind_${step.kind}`)} · {t(step.join === "ALL" ? "joinAll" : "joinAny")} · {label}
                </li>
              );
            })}
            </ol>
            {doc.route?.status === "OPEN" && doc.template.steps.find((step) => step.stepOrder === doc.route?.currentStep)?.join === "ALL" ? (
              <ul className="mt-2">
                {(doc.route.tasks ?? [])
                  .filter((task) => task.status === "OPEN" && task.stepOrder === doc.route?.currentStep)
                  .map((task) => {
                    const seat = employments.find((row) => row.id === task.assigneeEmploymentId);
                    return <li key={task.id}>{t("stillWaiting")}: {seat ? `${seat.positionName} · ${seat.orgUnitName}` : task.assigneeEmploymentId}</li>;
                  })}
              </ul>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
