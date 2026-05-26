"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type Project = { id: string; code: string; name: string };

export default function FieldOpsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(Array.isArray(d) ? d : []));
  }, []);

  async function addDailyLog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!projectId) return;
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/projects/${projectId}/daily-logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logDate: fd.get("logDate"),
        weather: fd.get("weather") || undefined,
        crewCount: Number(fd.get("crewCount")) || undefined,
        notes: fd.get("notes") || undefined,
        reportedBy: fd.get("reportedBy") || undefined,
      }),
    });
    const data = await res.json();
    setMessage(res.ok ? "Daily log saved" : (data.error ?? "Failed"));
  }

  return (
    <>
      <PageHeader
        title="Field ops (W2)"
        subtitle="M6 daily log · M7 punch list · M9 subcontractor claims"
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            Home
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-6 text-[13px]`}>
        {message && <p>{message}</p>}
        <label className="block">
          Project
          <select
            className="mt-1 block w-full rounded border px-2 py-1"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Select…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </label>
        {projectId && (
          <>
            <form onSubmit={addDailyLog} className="space-y-2 border-t pt-4">
              <h2 className="font-semibold">Daily log (M6)</h2>
              <input name="logDate" type="date" required className="block rounded border px-2 py-1" />
              <input name="weather" placeholder="Weather" className="block w-full rounded border px-2 py-1" />
              <input name="crewCount" type="number" min={0} placeholder="Crew count" className="block w-full rounded border px-2 py-1" />
              <textarea name="notes" rows={2} placeholder="Notes" className="block w-full rounded border px-2 py-1" />
              <input name="reportedBy" placeholder="Reported by" className="block w-full rounded border px-2 py-1" />
              <button type="submit" className={PRIMARY_BUTTON_CLASS}>
                Save log
              </button>
            </form>
            <p>
              <Link href={`/projects/${projectId}`} className="text-[#2980B9] hover:underline">
                Punch list & claims on project detail →
              </Link>
            </p>
          </>
        )}
      </div>
    </>
  );
}
