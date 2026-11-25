"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  Field,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";
import { bakuDateTimeDisplay } from "@era/satellite-kit/time";

const SELECTION_STATUSES = ["OPEN", "APPROVED", "CLOSED"] as const;
const WARRANTY_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

type PipelineStageOpt = {
  id: string;
  name: string;
  sortOrder: number;
  legacyStage?: string | null;
};

type LeadDetail = {
  id: string;
  title: string;
  contactRef: string;
  stage: string;
  stageId?: string | null;
  pipelineId?: string | null;
  channel: string;
  partyKind: string;
  taxId?: string | null;
  companyName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  activitySector?: string | null;
  prospectType: string;
  addressLabel?: string | null;
  globalPersonId?: string | null;
  estimatedAmount?: string | number | null;
  nextContactAt?: string | null;
  convertedAt?: string | null;
  counterpartyId?: string | null;
  customJson?: string;
  visits: { id: string; notes?: string | null; visitedAt: string }[];
  stageHistory: { fromStage?: string | null; toStage: string; changedAt: string }[];
  selectionPackages?: {
    id: string;
    status: string;
    notes?: string | null;
    items: { id: string; code: string; label: string; status: string }[];
  }[];
  warrantyCases?: {
    id: string;
    subject: string;
    status: string;
    constructionProjectId?: string | null;
  }[];
};

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"];

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("leadCard");
  const tc = useTranslations("common");
  const tLeads = useTranslations("leads");
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [warrantyOpen, setWarrantyOpen] = useState(false);
  const [warSubject, setWarSubject] = useState("");
  const [warProjectId, setWarProjectId] = useState("");
  const [warNotes, setWarNotes] = useState("");
  const [itemOpenFor, setItemOpenFor] = useState<string | null>(null);
  const [itemCode, setItemCode] = useState("");
  const [itemLabel, setItemLabel] = useState("");
  const [itemAmount, setItemAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [activities, setActivities] = useState<
    { id: string; type: string; payloadJson: string; createdAt: string }[]
  >([]);
  const [calls, setCalls] = useState<
    {
      id: string;
      direction: string;
      status: string;
      fromNumber?: string | null;
      toNumber?: string | null;
      durationSec?: number | null;
      recordingUrl?: string | null;
      startedAt: string;
    }[]
  >([]);
  const [mailThreads, setMailThreads] = useState<
    {
      id: string;
      channel: string;
      lastMessageAt?: string | null;
      preview?: string | null;
    }[]
  >([]);
  const [callTo, setCallTo] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [mergeDupId, setMergeDupId] = useState("");
  const [fieldDefs, setFieldDefs] = useState<
    { key: string; label: string; fieldType: string; optionsJson: string }[]
  >([]);
  const [customDraft, setCustomDraft] = useState<Record<string, string>>({});
  const [leadTags, setLeadTags] = useState<{ id: string; name: string }[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [boardStages, setBoardStages] = useState<PipelineStageOpt[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [leadRes, actRes, callRes, convRes, defsRes, tagsRes, pipeRes] =
        await Promise.all([
        fetch(`/api/leads/${id}`),
        fetch(`/api/leads/${id}/activities`),
        fetch(`/api/calls?leadId=${encodeURIComponent(id)}`),
        fetch(`/api/conversations?leadId=${encodeURIComponent(id)}`),
        fetch("/api/custom-fields?entity=LEAD"),
        fetch(`/api/leads/${id}/tags`),
        fetch("/api/pipelines"),
      ]);
      const data = await leadRes.json();
      if (!leadRes.ok) throw new Error(data.error ?? "Not found");
      setLead(data);
      setCallTo(data.contactPhone || data.contactRef || "");
      try {
        const parsed = JSON.parse(data.customJson || "{}") as Record<string, unknown>;
        const draft: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          draft[k] = v == null ? "" : String(v);
        }
        setCustomDraft(draft);
      } catch {
        setCustomDraft({});
      }
      if (defsRes.ok) {
        const defsJson = await defsRes.json();
        setFieldDefs(defsJson.items ?? []);
      } else {
        setFieldDefs([]);
      }
      if (tagsRes.ok) {
        const tagsJson = await tagsRes.json();
        setLeadTags(tagsJson.items ?? []);
      } else {
        setLeadTags([]);
      }
      if (actRes.ok) {
        const actJson = await actRes.json();
        setActivities(actJson.items ?? actJson ?? []);
      } else {
        setActivities([]);
      }
      if (callRes.ok) {
        const callJson = await callRes.json();
        setCalls(callJson.items ?? []);
      } else {
        setCalls([]);
      }
      if (convRes.ok) {
        const convJson = await convRes.json();
        const items = (convJson.items ?? []) as {
          id: string;
          channel: string;
          lastMessageAt?: string | null;
          lastMessagePreview?: string | null;
          preview?: string | null;
        }[];
        setMailThreads(
          items.filter((c) =>
            /mail|email|gmail|ms365|outlook|office365/i.test(c.channel),
          ),
        );
      } else {
        setMailThreads([]);
      }
      if (pipeRes.ok) {
        const pipeJson = (await pipeRes.json()) as {
          items?: Array<{
            id: string;
            isDefault: boolean;
            stages: PipelineStageOpt[];
          }>;
        };
        const items = pipeJson.items ?? [];
        const pipe =
          items.find((p) => p.id === data.pipelineId) ??
          items.find((p) => p.isDefault) ??
          items[0];
        setBoardStages(
          pipe?.stages
            ? [...pipe.stages].sort((a, b) => a.sortOrder - b.sortOrder)
            : [],
        );
      } else {
        setBoardStages([]);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function saveCustomFields() {
    const custom: Record<string, unknown> = {};
    for (const def of fieldDefs) {
      const raw = customDraft[def.key] ?? "";
      if (def.fieldType === "NUMBER") {
        custom[def.key] = raw === "" ? null : Number(raw);
      } else if (def.fieldType === "BOOL") {
        custom[def.key] = raw === "true" || raw === "1";
      } else {
        custom[def.key] = raw;
      }
    }
    const res = await fetch(`/api/leads/${id}/custom`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Save failed");
      return;
    }
    setMessage(t("customSaved"));
    await load();
  }

  async function addTag() {
    if (!tagDraft.trim()) return;
    const res = await fetch(`/api/leads/${id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tagDraft.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Tag failed");
      return;
    }
    setTagDraft("");
    await load();
  }

  async function removeTag(tagId: string) {
    const res = await fetch(`/api/leads/${id}/tags/${tagId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error ?? "Remove tag failed");
      return;
    }
    await load();
  }

  async function originate() {
    if (!connectionId || !callTo.trim()) {
      setMessage(t("callNeedConnection"));
      return;
    }
    const res = await fetch("/api/calls/originate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, to: callTo.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Originate failed");
      return;
    }
    setMessage(t("callQueued"));
    await load();
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function changeStage(stage: string) {
    const res = await fetch(`/api/leads/${id}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? tLeads("stageChangeFailed"));
      return;
    }
    setMessage(t("stageUpdated"));
    await load();
  }

  async function changePipelineStage(stageId: string) {
    const res = await fetch(`/api/leads/${id}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? tLeads("stageChangeFailed"));
      return;
    }
    setMessage(t("stageUpdated"));
    await load();
  }

  async function convert() {
    const res = await fetch(`/api/leads/${id}/convert`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Convert failed");
      return;
    }
    setMessage(tLeads("converted", { id: id.slice(0, 8) }));
    await load();
  }

  async function mergeDuplicate() {
    const duplicateLeadId = mergeDupId.trim();
    if (!duplicateLeadId) return;
    if (!window.confirm(t("mergeConfirm"))) return;
    const res = await fetch("/api/leads/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ survivorLeadId: id, duplicateLeadId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Merge failed");
      return;
    }
    setMergeDupId("");
    setMessage(t("mergeDone"));
    await load();
  }

  if (loading) return <p className="p-6 text-[13px]">{tc("loading")}</p>;
  if (!lead) return <p className="p-6 text-[13px]">{message || tc("notFound")}</p>;

  return (
    <>
      <PageHeader
        title={lead.title}
        subtitle={t("subtitle", { stage: lead.stage })}
        actions={
          <Link href="/leads" className={PRIMARY_BUTTON_CLASS}>
            {tLeads("pipelineBack")}
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-6`}>
        {message && <p className="text-[13px]">{message}</p>}

        <section>
          <h2 className="text-[13px] font-semibold uppercase text-[#7F8C8D]">
            {t("partyBlock")}
          </h2>
          <dl className="mt-2 grid gap-1 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-[#7F8C8D]">{tLeads("partyKind")}</dt>
              <dd>{lead.partyKind}</dd>
            </div>
            <div>
              <dt className="text-[#7F8C8D]">{tLeads("prospectType")}</dt>
              <dd>{lead.prospectType}</dd>
            </div>
            {lead.taxId && (
              <div>
                <dt className="text-[#7F8C8D]">VÖEN</dt>
                <dd>{lead.taxId}</dd>
              </div>
            )}
            {lead.companyName && (
              <div>
                <dt className="text-[#7F8C8D]">{tLeads("companyName")}</dt>
                <dd>{lead.companyName}</dd>
              </div>
            )}
            {lead.contactPhone && (
              <div>
                <dt className="text-[#7F8C8D]">{tLeads("contactPhone")}</dt>
                <dd>{lead.contactPhone}</dd>
              </div>
            )}
            {lead.contactEmail && (
              <div>
                <dt className="text-[#7F8C8D]">{tLeads("contactEmail")}</dt>
                <dd>{lead.contactEmail}</dd>
              </div>
            )}
            {lead.activitySector && (
              <div>
                <dt className="text-[#7F8C8D]">{tLeads("activitySector")}</dt>
                <dd>{lead.activitySector}</dd>
              </div>
            )}
            {lead.globalPersonId && (
              <div>
                <dt className="text-[#7F8C8D]">MDM</dt>
                <dd className="font-mono text-[11px]">{lead.globalPersonId}</dd>
              </div>
            )}
          </dl>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold uppercase text-[#7F8C8D]">
            {t("actions")}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {boardStages.length > 0 ? (
              <select
                className="rounded border px-2 py-1 text-[13px]"
                aria-label={tLeads("pipelineStage")}
                value={lead.stageId ?? ""}
                onChange={(e) => {
                  if (e.target.value) void changePipelineStage(e.target.value);
                }}
              >
                {!lead.stageId ? (
                  <option value="">{lead.stage}</option>
                ) : null}
                {boardStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                className="rounded border px-2 py-1 text-[13px]"
                aria-label={tLeads("pipelineStage")}
                value={lead.stage}
                onChange={(e) => void changeStage(e.target.value)}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            {lead.stage !== "WON" && lead.stage !== "LOST" && (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => void convert()}
              >
                {tLeads("convert")}
              </button>
            )}
          </div>
          <div className="mt-6 space-y-2">
            <h3 className="text-[12px] font-semibold uppercase text-[#7F8C8D]">
              {t("paymentTitle")}
            </h3>
            <p className="text-xs text-[#7F8C8D]">{t("paymentHint")}</p>
            {(() => {
              let link = "";
              let status = "";
              try {
                const o = JSON.parse(lead.customJson || "{}") as Record<
                  string,
                  unknown
                >;
                link = typeof o._paymentLink === "string" ? o._paymentLink : "";
                status =
                  typeof o._paymentStatus === "string" ? o._paymentStatus : "";
              } catch {
                /* ignore */
              }
              return (
                <dl className="text-[13px]">
                  <div>
                    <dt className="text-[#7F8C8D]">{t("paymentStatus")}</dt>
                    <dd>{status || t("paymentNone")}</dd>
                  </div>
                  {link ? (
                    <div className="mt-1">
                      <dt className="text-[#7F8C8D]">{t("paymentLink")}</dt>
                      <dd className="break-all">
                        <a
                          href={link}
                          className="text-[#2980B9] underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {link}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              );
            })()}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => {
                  void (async () => {
                    const res = await fetch(`/api/leads/${id}/payment`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ paymentStatus: "PAID" }),
                    });
                    if (!res.ok) {
                      const data = await res.json();
                      setMessage(data.error ?? "Payment update failed");
                      return;
                    }
                    setMessage(t("paymentMarkedPaid"));
                    await load();
                  })();
                }}
              >
                {t("paymentMarkPaid")}
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="text-[12px] font-semibold uppercase text-[#7F8C8D]">
              {t("customTitle")}
            </h3>
            {fieldDefs.length === 0 ? (
              <p className="text-xs text-[#7F8C8D]">{t("customEmpty")}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {fieldDefs.map((def) => {
                  let options: string[] = [];
                  try {
                    options = JSON.parse(def.optionsJson || "[]") as string[];
                  } catch {
                    options = [];
                  }
                  if (def.fieldType === "SELECT") {
                    return (
                      <CatalogField
                        key={def.key}
                        kind="CLOSED_SMALL"
                        label={def.label}
                        value={customDraft[def.key] ?? ""}
                        onChange={(v) =>
                          setCustomDraft((prev) => ({
                            ...prev,
                            [def.key]: String(v),
                          }))
                        }
                        options={options.map((o) => ({ value: o, label: o }))}
                      />
                    );
                  }
                  if (def.fieldType === "BOOL") {
                    return (
                      <CatalogField
                        key={def.key}
                        kind="CLOSED_SMALL"
                        label={def.label}
                        value={customDraft[def.key] === "true" ? "true" : "false"}
                        onChange={(v) =>
                          setCustomDraft((prev) => ({
                            ...prev,
                            [def.key]: String(v),
                          }))
                        }
                        options={[
                          { value: "true", label: t("boolYes") },
                          { value: "false", label: t("boolNo") },
                        ]}
                      />
                    );
                  }
                  return (
                    <Field
                      key={def.key}
                      label={def.label}
                      preset="shortText"
                      value={customDraft[def.key] ?? ""}
                      onChange={(e) =>
                        setCustomDraft((prev) => ({
                          ...prev,
                          [def.key]: e.target.value,
                        }))
                      }
                    />
                  );
                })}
              </div>
            )}
            {fieldDefs.length > 0 ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => void saveCustomFields()}
              >
                {t("customSave")}
              </button>
            ) : null}
            <div className="space-y-2 pt-2">
              <h3 className="text-[12px] font-semibold uppercase text-[#7F8C8D]">
                {t("tagsTitle")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {leadTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className="rounded border border-[#D5DADF] px-2 py-0.5 text-[12px]"
                    onClick={() => void removeTag(tag.id)}
                    title={t("tagRemove")}
                  >
                    {tag.name} ×
                  </button>
                ))}
                {leadTags.length === 0 ? (
                  <span className="text-xs text-[#7F8C8D]">{t("tagsEmpty")}</span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Field
                  label={t("tagName")}
                  preset="shortText"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                />
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={!tagDraft.trim()}
                  onClick={() => void addTag()}
                >
                  {t("tagAdd")}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <h3 className="text-[12px] font-semibold uppercase text-[#7F8C8D]">
              {t("mergeTitle")}
            </h3>
            <p className="text-xs text-[#7F8C8D]">{t("mergeHint")}</p>
            <div className="flex flex-wrap items-end gap-2">
              <Field
                label={t("mergeDupId")}
                preset="shortText"
                value={mergeDupId}
                onChange={(e) => setMergeDupId(e.target.value)}
              />
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={!mergeDupId.trim()}
                onClick={() => void mergeDuplicate()}
              >
                {t("mergeRun")}
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold uppercase text-[#7F8C8D]">
            {t("emailThreads")}
          </h2>
          <ul className="mt-2 space-y-1 text-[12px]">
            {mailThreads.length === 0 ? (
              <li className="text-[#7F8C8D]">{t("noEmailThreads")}</li>
            ) : (
              mailThreads.map((c) => (
                <li key={c.id}>
                  <Link href={`/inbox?c=${c.id}`} className="text-[#2980B9] underline">
                    {c.channel}
                  </Link>
                  {c.lastMessageAt ? (
                    <span className="text-[#7F8C8D]">
                      {" "}
                      · {bakuDateTimeDisplay(c.lastMessageAt)}
                    </span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold uppercase text-[#7F8C8D]">
            {t("calls")}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Field
              label={t("connectionId")}
              preset="shortText"
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
            />
            <Field
              label={t("callTo")}
              preset="shortText"
              value={callTo}
              onChange={(e) => setCallTo(e.target.value)}
            />
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void originate()}>
              {t("clickToCall")}
            </button>
          </div>
          <ul className="mt-2 space-y-1 text-[12px]">
            {calls.length === 0 ? (
              <li className="text-[#7F8C8D]">{t("noCalls")}</li>
            ) : (
              calls.map((c) => (
                <li key={c.id}>
                  {c.direction} {c.status} {c.fromNumber ?? ""} → {c.toNumber ?? ""}{" "}
                  <span className="text-[#7F8C8D]">{bakuDateTimeDisplay(c.startedAt)}</span>
                  {c.recordingUrl ? (
                    <audio className="mt-1 block w-full" controls src={c.recordingUrl} />
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold uppercase text-[#7F8C8D]">
            {t("timeline")}
          </h2>
          <ul className="mt-2 space-y-1 text-[12px]">
            {activities.length === 0 ? (
              <li className="text-[#7F8C8D]">{t("noActivities")}</li>
            ) : (
              activities.map((a) => (
                <li key={a.id}>
                  <span className="font-medium">{a.type}</span>{" "}
                  <span className="text-[#7F8C8D]">
                    {bakuDateTimeDisplay(a.createdAt)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold uppercase text-[#7F8C8D]">
            {t("stageHistory")}
          </h2>
          <ul className="mt-2 space-y-1 text-[12px]">
            {lead.stageHistory.map((h) => (
              <li key={`${h.changedAt}-${h.toStage}`}>
                {h.fromStage ?? "—"} → {h.toStage}{" "}
                <span className="text-[#7F8C8D]">
                  {bakuDateTimeDisplay(h.changedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold uppercase text-[#7F8C8D]">
            {t("visits")}
          </h2>
          <ul className="mt-2 space-y-1 text-[12px]">
            {lead.visits.length === 0 ? (
              <li className="text-[#7F8C8D]">{t("noVisits")}</li>
            ) : (
              lead.visits.map((v) => (
                <li key={v.id}>
                  {bakuDateTimeDisplay(v.visitedAt)} — {v.notes ?? "—"}
                </li>
              ))
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold uppercase text-[#7F8C8D]">
            {t("selections")}
          </h2>
          <ul className="mt-2 space-y-3 text-[12px]">
            {(lead.selectionPackages ?? []).length === 0 ? (
              <li className="text-[#7F8C8D]">{t("noSelections")}</li>
            ) : (
              (lead.selectionPackages ?? []).map((pkg) => (
                <li key={pkg.id} className="space-y-2">
                  <div className="flex flex-wrap items-end gap-3">
                    <span className="font-medium">
                      {t("selectionItems", { count: pkg.items.length })}
                    </span>
                    <CatalogField
                      kind="CLOSED_SMALL"
                      label={t("selectionStatus")}
                      value={pkg.status}
                      onChange={(v) => {
                        const next = String(v);
                        if (next === pkg.status) return;
                        void (async () => {
                          const res = await fetch(`/api/selection-packages/${pkg.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: next }),
                          });
                          if (!res.ok) {
                            const data = await res.json();
                            setMessage(data.error ?? t("selectionStatusFailed"));
                            return;
                          }
                          setMessage(t("selectionStatusUpdated"));
                          await load();
                        })();
                      }}
                      options={SELECTION_STATUSES.map((s) => ({
                        value: s,
                        label: t(`selectionStatusValue.${s}`),
                      }))}
                      hideLabel
                    />
                  </div>
                  <ul className="ml-3 list-disc text-[#7F8C8D]">
                    {pkg.items.map((it) => (
                      <li key={it.id}>
                        {it.code} — {it.label} ({it.status})
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => {
                      setItemOpenFor(pkg.id);
                      setItemCode("");
                      setItemLabel("");
                      setItemAmount("");
                    }}
                  >
                    {t("addSelectionItem")}
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold uppercase text-[#7F8C8D]">
            {t("warranty")}
          </h2>
          <ul className="mt-2 space-y-3 text-[12px]">
            {(lead.warrantyCases ?? []).length === 0 ? (
              <li className="text-[#7F8C8D]">{t("noWarranty")}</li>
            ) : (
              (lead.warrantyCases ?? []).map((c) => (
                <li key={c.id} className="flex flex-wrap items-end gap-3">
                  <span>
                    {c.subject}
                    {c.constructionProjectId
                      ? ` · ${t("projectRef", { id: c.constructionProjectId })}`
                      : ""}
                  </span>
                  <CatalogField
                    kind="CLOSED_SMALL"
                    label={t("warrantyStatus")}
                    value={c.status}
                    onChange={(v) => {
                      const next = String(v);
                      if (next === c.status) return;
                      void (async () => {
                        const res = await fetch(`/api/warranty-cases/${c.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: next }),
                        });
                        if (!res.ok) {
                          const data = await res.json();
                          setMessage(data.error ?? t("warrantyStatusFailed"));
                          return;
                        }
                        setMessage(t("warrantyStatusUpdated"));
                        await load();
                      })();
                    }}
                    options={WARRANTY_STATUSES.map((s) => ({
                      value: s,
                      label: t(`warrantyStatusValue.${s}`),
                    }))}
                    hideLabel
                  />
                </li>
              ))
            )}
          </ul>
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} mt-2`}
            onClick={() => {
              setWarSubject(t("warrantyDefaultSubject"));
              setWarProjectId("");
              setWarNotes("");
              setWarrantyOpen(true);
            }}
          >
            {t("addWarranty")}
          </button>
        </section>
      </div>

      {warrantyOpen ? (
        <ModalShell
          title={t("addWarranty")}
          onClose={() => setWarrantyOpen(false)}
          closeLabel={tc("cancel")}
          maxWidthClass="max-w-lg"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setWarrantyOpen(false)}
              >
                {tc("cancel")}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy || !warSubject.trim()}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    const res = await fetch(`/api/leads/${id}/warranty-cases`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        subject: warSubject.trim(),
                        constructionProjectId: warProjectId.trim() || undefined,
                        notes: warNotes.trim() || undefined,
                      }),
                    });
                    setBusy(false);
                    if (!res.ok) {
                      const data = await res.json();
                      setMessage(data.error ?? t("warrantyCreateFailed"));
                      return;
                    }
                    setWarrantyOpen(false);
                    setMessage(t("warrantyCreated"));
                    await load();
                  })();
                }}
              >
                {t("addWarranty")}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <Field
              label={t("warrantySubject")}
              preset="shortText"
              value={warSubject}
              onChange={(e) => setWarSubject(e.target.value)}
              required
            />
            <Field
              label={t("warrantyProjectId")}
              preset="shortText"
              value={warProjectId}
              onChange={(e) => setWarProjectId(e.target.value)}
            />
            <Field
              label={t("warrantyNotes")}
              preset="shortText"
              value={warNotes}
              onChange={(e) => setWarNotes(e.target.value)}
            />
          </div>
        </ModalShell>
      ) : null}

      {itemOpenFor ? (
        <ModalShell
          title={t("addSelectionItem")}
          onClose={() => setItemOpenFor(null)}
          closeLabel={tc("cancel")}
          maxWidthClass="max-w-lg"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setItemOpenFor(null)}
              >
                {tc("cancel")}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy || !itemCode.trim() || !itemLabel.trim()}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    const res = await fetch(
                      `/api/selection-packages/${itemOpenFor}/items`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          code: itemCode.trim(),
                          label: itemLabel.trim(),
                          amount: itemAmount.trim()
                            ? Number(itemAmount)
                            : undefined,
                        }),
                      },
                    );
                    setBusy(false);
                    if (!res.ok) {
                      const data = await res.json();
                      setMessage(data.error ?? t("selectionItemFailed"));
                      return;
                    }
                    setItemOpenFor(null);
                    setMessage(t("selectionItemAdded"));
                    await load();
                  })();
                }}
              >
                {t("addSelectionItem")}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <Field
              label={t("selectionItemCode")}
              preset="shortText"
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
              required
            />
            <Field
              label={t("selectionItemLabel")}
              preset="shortText"
              value={itemLabel}
              onChange={(e) => setItemLabel(e.target.value)}
              required
            />
            <Field
              label={t("selectionItemAmount")}
              preset="shortText"
              value={itemAmount}
              onChange={(e) => setItemAmount(e.target.value)}
            />
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
