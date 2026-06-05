"use client";

import { useCallback, useEffect, useState } from "react";
import { BodySilhouette } from "./BodySilhouette";

type Row = { id: string; bodyPart: string; note: string | null };

export function PatientContraindicationsPanel({ patientRefId }: { patientRefId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/patients/${patientRefId}/contraindications`);
    if (res.ok) {
      const data = (await res.json()) as Row[];
      setRows(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, [patientRefId]);

  useEffect(() => {
    void load();
  }, [load]);

  const blocked = new Set(rows.map((r) => r.bodyPart));

  async function onToggle(bodyPart: string) {
    if (blocked.has(bodyPart)) {
      const row = rows.find((r) => r.bodyPart === bodyPart);
      if (!row) return;
      await fetch(`/api/patients/${patientRefId}/contraindications?id=${row.id}`, {
        method: "DELETE",
      });
    } else {
      await fetch(`/api/patients/${patientRefId}/contraindications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyPart }),
      });
    }
    await load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-3">
      <BodySilhouette blocked={blocked} onToggle={onToggle} />
      <ul className="text-sm text-slate-600">
        {rows.length === 0 ? (
          <li>No contraindicated zones</li>
        ) : (
          rows.map((r) => (
            <li key={r.id}>
              {r.bodyPart}
              {r.note ? ` — ${r.note}` : ""}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
