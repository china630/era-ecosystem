"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS, PageHeader } from "@era/satellite-kit/ui";

type LeadDetail = {
  id: string;
  title: string;
  contactRef: string;
  stage: string;
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
  visits: { id: string; notes?: string | null; visitedAt: string }[];
  stageHistory: { fromStage?: string | null; toStage: string; changedAt: string }[];
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

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Not found");
      setLead(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
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
      setMessage(data.error ?? "Stage change failed");
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
            <select
              className="rounded border px-2 py-1 text-[13px]"
              value={lead.stage}
              onChange={(e) => void changeStage(e.target.value)}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
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
                  {new Date(h.changedAt).toLocaleString()}
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
                  {new Date(v.visitedAt).toLocaleString()} — {v.notes ?? "—"}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </>
  );
}
