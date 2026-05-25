"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";

type Episode = {
  id: string;
  reservationId: string | null;
  hotelStayId: string | null;
  organizationId: string;
  status: string;
  openedAt: string;
  patientRef: { fullName: string; refCode: string } | null;
  complaints: { text: string; recordedAt: string }[];
  diagnoses: { icdCode: string | null; description: string }[];
  labOrders: { id: string; testCode: string; status: string }[];
};

export default function SanatoriumPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [complaint, setComplaint] = useState("");
  const [icdCode, setIcdCode] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [testCode, setTestCode] = useState("CBC");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/sanatorium/episodes");
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    setEpisodes(list);
    if (!selectedId && list[0]?.id) setSelectedId(list[0].id);
  }, [selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = episodes.find((e) => e.id === selectedId);

  async function postAction(action: string, body: unknown) {
    if (!selectedId) return;
    const res = await fetch(`/api/sanatorium/episodes/${selectedId}?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setMsg(res.ok ? "Saved" : data.error ?? "Failed");
    if (res.ok) await load();
  }

  return (
    <>
      <PageHeader
        title="Sanatorium in-house"
        subtitle="K5 — clinical episodes for hotel stays (US-06, US-07)"
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            Home
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-6`}>
        {msg && <p className="text-[13px] text-emerald-700">{msg}</p>}
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-[#34495E]">In-house list</h2>
            <ul className="space-y-2 text-[13px]">
              {episodes.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className={`w-full rounded border px-3 py-2 text-left ${
                      e.id === selectedId ? "border-sky-500 bg-sky-50" : "border-[#ECF0F1]"
                    }`}
                    onClick={() => setSelectedId(e.id)}
                  >
                    <div className="font-medium">{e.patientRef?.fullName ?? "Guest"}</div>
                    <div className="text-[#7F8C8D]">
                      Stay {e.reservationId?.slice(0, 8) ?? "—"} · {e.status}
                    </div>
                  </button>
                </li>
              ))}
              {episodes.length === 0 && (
                <li className="text-[#7F8C8D]">No open episodes — check in a medical package guest in PMS.</li>
              )}
            </ul>
          </div>
          {selected && (
            <div className="space-y-4 text-[13px]">
              <div>
                <strong>{selected.patientRef?.fullName}</strong> ({selected.patientRef?.refCode})
              </div>
              <div>
                <h3 className="font-semibold">Complaints</h3>
                <ul className="list-disc pl-5">
                  {selected.complaints.map((c, i) => (
                    <li key={i}>{c.text}</li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <input
                    className="flex-1 rounded border px-2 py-1"
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                    placeholder="New complaint"
                  />
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    onClick={() => postAction("complaint", { text: complaint })}
                  >
                    Add
                  </button>
                </div>
              </div>
              <div>
                <h3 className="font-semibold">Diagnoses</h3>
                <ul className="list-disc pl-5">
                  {selected.diagnoses.map((d, i) => (
                    <li key={i}>
                      {d.icdCode ? `${d.icdCode}: ` : ""}
                      {d.description}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <input
                    className="rounded border px-2 py-1"
                    value={icdCode}
                    onChange={(e) => setIcdCode(e.target.value)}
                    placeholder="ICD"
                  />
                  <input
                    className="col-span-2 rounded border px-2 py-1"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="Description"
                  />
                  <button
                    type="button"
                    className={`${PRIMARY_BUTTON_CLASS} col-span-3`}
                    onClick={() => postAction("diagnosis", { icdCode, description: diagnosis })}
                  >
                    Add diagnosis
                  </button>
                </div>
              </div>
              <div>
                <h3 className="font-semibold">Lab orders</h3>
                <ul>
                  {selected.labOrders.map((o) => (
                    <li key={o.id}>
                      {o.testCode} — {o.status}{" "}
                      <Link href={`/lab-orders/${o.id}`} className="text-sky-600 underline">
                        workflow
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <input
                    className="flex-1 rounded border px-2 py-1"
                    value={testCode}
                    onChange={(e) => setTestCode(e.target.value)}
                  />
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    onClick={() => postAction("lab", { testCode })}
                  >
                    Order lab
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
