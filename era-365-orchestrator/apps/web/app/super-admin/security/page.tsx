"use client";

import { useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { orchFetch } from "../../../lib/orch-api";
import { useAuth } from "../../../lib/auth-context";

export default function SuperAdminSecurityPage() {
  const { token } = useAuth();
  const [orgId, setOrgId] = useState("");
  const [state, setState] = useState<unknown>(null);
  const [disputes, setDisputes] = useState<Array<{ id: string; status: string }>>([]);
  const [disputeId, setDisputeId] = useState("");
  const [newStatus, setNewStatus] = useState("UNDER_REVIEW");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token || !orgId.trim()) return;
    setError(null);
    const id = orgId.trim();
    const [sRes, dRes] = await Promise.all([
      orchFetch(`/admin/organizations/${id}/security-state`, { token }),
      orchFetch(`/admin/organizations/${id}/disputes`, { token }),
    ]);
    if (!sRes.ok || !dRes.ok) {
      setError("Failed to load (check org UUID and super-admin role)");
      return;
    }
    setState(await sRes.json());
    const d = (await dRes.json()) as Array<{ id: string; status: string }>;
    setDisputes(Array.isArray(d) ? d : []);
  }

  async function patchDispute() {
    if (!token || !orgId.trim() || !disputeId.trim()) return;
    const res = await orchFetch(
      `/admin/organizations/${orgId.trim()}/disputes/${disputeId.trim()}/status`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify({ status: newStatus }),
      },
    );
    if (!res.ok) {
      setError("Patch dispute failed");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Org security & disputes</h1>
      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap gap-2 p-4`}>
        <input
          className="h-9 min-w-[280px] flex-1 rounded-lg border border-[#D5DADF] px-3 text-sm"
          placeholder="Organization UUID"
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
        />
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
          Load
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap gap-2 p-4`}>
        <input
          className="h-9 min-w-[200px] rounded-lg border border-[#D5DADF] px-3 text-sm"
          placeholder="Dispute UUID"
          value={disputeId}
          onChange={(e) => setDisputeId(e.target.value)}
        />
        <select
          className="h-9 rounded-lg border border-[#D5DADF] px-3 text-sm"
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
        >
          <option value="EVIDENCE_REQUIRED">EVIDENCE_REQUIRED</option>
          <option value="EVIDENCE_REVIEW">EVIDENCE_REVIEW</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="EXECUTED">EXECUTED</option>
        </select>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void patchDispute()}>
          Update dispute
        </button>
      </div>
      <pre className={`${CARD_CONTAINER_CLASS} overflow-auto p-4 text-xs`}>
        {JSON.stringify({ securityState: state, disputes }, null, 2)}
      </pre>
    </div>
  );
}
