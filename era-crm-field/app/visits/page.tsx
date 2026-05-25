"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type LeadOption = { id: string; title: string; contactRef: string };

type Visit = {
  id: string;
  notes?: string | null;
  visitedAt: string;
  lead: { id: string; title: string; contactRef: string };
};

export default function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadId, setLeadId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadVisits() {
    setLoading(true);
    try {
      const res = await fetch("/api/visits");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load visits");
      setVisits(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadVisits();
    fetch("/api/leads")
      .then((res) => res.json())
      .then((data) => setLeads(Array.isArray(data) ? data : []))
      .catch(() => setLeads([]));
  }, []);

  async function logVisit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!leadId) {
      setMessage("Select a lead");
      return;
    }
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to log visit");
      setNotes("");
      setMessage(`Visit logged — event dispatched for ${data.lead?.title ?? leadId}`);
      await loadVisits();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <>
      <PageHeader
        title="Field visits"
        subtitle="C2 — visit log and recent activity"
        actions={
          <div className="flex gap-2">
            <Link href="/leads" className={PRIMARY_BUTTON_CLASS}>
              Pipeline
            </Link>
            <Link href="/" className={PRIMARY_BUTTON_CLASS}>
              Home
            </Link>
          </div>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-6`}>
        <form onSubmit={logVisit} className="space-y-3 rounded border p-4">
          <h2 className="text-[13px] font-semibold text-[#34495E]">Log visit</h2>
          <label className="block text-[13px]">
            Lead
            <select
              className="mt-1 block w-full rounded border px-2 py-1"
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
            >
              <option value="">Select lead…</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.title} ({lead.contactRef})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[13px]">
            Notes
            <textarea
              className="mt-1 block w-full rounded border px-2 py-1"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Site visit notes…"
            />
          </label>
          <button type="submit" className={PRIMARY_BUTTON_CLASS}>
            Log visit
          </button>
        </form>

        {message && <p className="text-[13px]">{message}</p>}

        <div>
          <h2 className="mb-2 text-[13px] font-semibold text-[#34495E]">Recent visits</h2>
          {loading ? (
            <p className="text-[13px] text-[#7F8C8D]">Loading…</p>
          ) : visits.length === 0 ? (
            <p className="text-[13px] text-[#7F8C8D]">No visits logged yet.</p>
          ) : (
            <ul className="space-y-2">
              {visits.map((visit) => (
                <li
                  key={visit.id}
                  className="rounded border p-3 text-[13px]"
                >
                  <div className="font-medium">{visit.lead.title}</div>
                  <div className="text-[#7F8C8D]">
                    {visit.lead.contactRef} ·{" "}
                    {new Date(visit.visitedAt).toLocaleString()}
                  </div>
                  {visit.notes && <p className="mt-1">{visit.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
