"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type Lead = {
  id: string;
  title: string;
  contactRef: string;
  stage: string;
  channel: string;
  estimatedAmount?: string | number | null;
};

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"];

export default function LeadsPipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadLeads() {
    setLoading(true);
    try {
      const res = await fetch("/api/leads");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load leads");
      setLeads(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeads();
  }, []);

  async function convertLead(id: string) {
    setMessage("");
    try {
      const res = await fetch(`/api/leads/${id}/convert`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Convert failed");
      setMessage(`Lead converted — event dispatched for ${id.slice(0, 8)}`);
      await loadLeads();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    }
  }

  const grouped = STAGES.map((stage) => ({
    stage,
    items: leads.filter((l) => l.stage === stage),
  }));

  return (
    <>
      <PageHeader
        title="ERA CRM Field"
        subtitle="Pipeline — leads by stage"
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            Home
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        {loading && <p className="text-[13px]">Loading…</p>}
        {message && <p className="text-[13px]">{message}</p>}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {grouped.map(({ stage, items }) => (
            <div key={stage} className="rounded border p-3">
              <h3 className="text-[12px] font-semibold uppercase text-[#7F8C8D]">
                {stage} ({items.length})
              </h3>
              <ul className="mt-2 space-y-2">
                {items.map((lead) => (
                  <li key={lead.id} className="rounded bg-[#F8F9FA] p-2 text-[12px]">
                    <div className="font-medium">{lead.title}</div>
                    <div className="text-[#7F8C8D]">{lead.contactRef}</div>
                    {lead.stage !== "WON" && lead.stage !== "LOST" && (
                      <button
                        type="button"
                        className="mt-1 text-[11px] text-[#2980B9] underline"
                        onClick={() => convertLead(lead.id)}
                      >
                        Convert
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
