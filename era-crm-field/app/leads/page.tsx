"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type Agent = {
  id: string;
  fullName: string;
  login: string;
  role: { code: string };
};

type Lead = {
  id: string;
  title: string;
  contactRef: string;
  stage: string;
  channel: string;
  ownerId?: string | null;
  owner?: { id: string; fullName: string; login: string } | null;
  estimatedAmount?: string | number | null;
  nextContactAt?: string | null;
};

type SessionUser = {
  id: string;
  fullName: string;
  role: { code: string };
};

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"];
const ASSIGN_ROLES = new Set(["SALES_LEAD", "BUSINESS_OWNER"]);

export default function LeadsPipelinePage() {
  return (
    <Suspense fallback={<p className="p-6 text-[13px]">Loading pipeline…</p>}>
      <LeadsPipelineContent />
    </Suspense>
  );
}

function LeadsPipelineContent() {
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [myLeadsOnly, setMyLeadsOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [prefillNotice, setPrefillNotice] = useState("");

  const canAssign = session ? ASSIGN_ROLES.has(session.role.code) : false;

  async function loadLeads(mine = myLeadsOnly) {
    setLoading(true);
    try {
      const query = mine ? "?mine=true" : "";
      const res = await fetch(`/api/leads${query}`);
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
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setAgents(Array.isArray(data) ? data : []))
      .catch(() => setAgents([]));
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSession(data))
      .catch(() => setSession(null));
  }, []);

  useEffect(() => {
    const channel = searchParams.get("channel");
    const contactRef = searchParams.get("contactRef");
    if (channel && contactRef) {
      setPrefillNotice(
        `Inbox pre-fill: create lead with channel=${channel}, contact=${contactRef}`,
      );
    }
  }, [searchParams]);

  useEffect(() => {
    void loadLeads(myLeadsOnly);
  }, [myLeadsOnly]);

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

  async function scheduleFollowUp(leadId: string, nextContactAt: string) {
    if (!nextContactAt) return;
    setMessage("");
    try {
      const res = await fetch(`/api/leads/${leadId}/follow-up`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nextContactAt: new Date(nextContactAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Follow-up failed");
      setMessage(`Follow-up scheduled for ${leadId.slice(0, 8)}`);
      await loadLeads(myLeadsOnly);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    }
  }

  async function assignLead(id: string, ownerId: string) {
    setMessage("");
    try {
      const res = await fetch(`/api/leads/${id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: ownerId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Assign failed");
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
          <div className="flex flex-wrap gap-2">
            <Link href="/visits" className={PRIMARY_BUTTON_CLASS}>
              Visits
            </Link>
            <Link href="/inbox" className={PRIMARY_BUTTON_CLASS}>
              Inbox
            </Link>
            <Link href="/" className={PRIMARY_BUTTON_CLASS}>
              Home
            </Link>
          </div>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        <div className="flex flex-wrap items-center gap-4 text-[13px]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={myLeadsOnly}
              onChange={(e) => setMyLeadsOnly(e.target.checked)}
            />
            My leads
            {session && (
              <span className="text-[#7F8C8D]">({session.fullName})</span>
            )}
          </label>
        </div>

        {loading && <p className="text-[13px]">Loading…</p>}
        {message && <p className="text-[13px]">{message}</p>}
        {prefillNotice && (
          <p className="text-[13px] text-[#2980B9]">{prefillNotice}</p>
        )}

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
                    {lead.owner && (
                      <div className="text-[11px] text-[#7F8C8D]">
                        Owner: {lead.owner.fullName}
                      </div>
                    )}
                    {canAssign && (
                      <label className="mt-1 block text-[11px]">
                        Assign
                        <select
                          className="mt-0.5 block w-full rounded border px-1 py-0.5"
                          value={lead.ownerId ?? ""}
                          onChange={(e) => assignLead(lead.id, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.fullName}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {lead.nextContactAt && (
                      <div className="text-[11px] text-[#E67E22]">
                        Next: {new Date(lead.nextContactAt).toLocaleString()}
                      </div>
                    )}
                    {lead.stage !== "WON" && lead.stage !== "LOST" && (
                      <>
                        <label className="mt-1 block text-[11px]">
                          Follow-up
                          <input
                            type="datetime-local"
                            className="mt-0.5 block w-full rounded border px-1 py-0.5"
                            onChange={(e) => {
                              if (e.target.value) {
                                void scheduleFollowUp(lead.id, e.target.value);
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="mt-1 text-[11px] text-[#2980B9] underline"
                          onClick={() => convertLead(lead.id)}
                        >
                          Convert
                        </button>
                      </>
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
