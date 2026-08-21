"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Field,
  ModalFooter,
  ModalShell,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";
import { BodySilhouette } from "./BodySilhouette";

type Row = { id: string; bodyPart: string; note: string | null };

type Props = {
  patientRefId: string;
  expanded?: boolean;
  onCountChange?: (count: number) => void;
};

export function PatientContraindicationsPanel({
  patientRefId,
  expanded = true,
  onCountChange,
}: Props) {
  const t = useTranslations("contraindications");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [removeRow, setRemoveRow] = useState<Row | null>(null);
  const [pendingPart, setPendingPart] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/patients/${patientRefId}/contraindications`);
    if (res.ok) {
      const parsed = await res.json();
      const data = (parsed.data ?? parsed) as Row[];
      setRows(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, [patientRefId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading) onCountChange?.(rows.length);
  }, [loading, rows.length, onCountChange]);

  const blocked = new Set(rows.map((r) => r.bodyPart));

  function onZoneClick(bodyPart: string) {
    if (blocked.has(bodyPart)) {
      const row = rows.find((r) => r.bodyPart === bodyPart);
      if (row) setRemoveRow(row);
      return;
    }
    setPendingPart(bodyPart);
    setNote("");
    setAddOpen(true);
  }

  async function confirmAdd() {
    await fetch(`/api/patients/${patientRefId}/contraindications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bodyPart: pendingPart, note: note.trim() || undefined }),
    });
    setAddOpen(false);
    await load();
  }

  async function confirmRemove() {
    if (!removeRow) return;
    await fetch(`/api/patients/${patientRefId}/contraindications?id=${removeRow.id}`, {
      method: "DELETE",
    });
    setRemoveRow(null);
    await load();
  }

  if (!expanded) return null;
  if (loading) return <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>;

  return (
    <div className="mt-3 space-y-3">
      <BodySilhouette blocked={blocked} onToggle={onZoneClick} />
      <ul className={`text-sm ${TEXT_MUTED_CLASS}`}>
        {rows.length === 0 ? (
          <li>{t("empty")}</li>
        ) : (
          rows.map((r) => (
            <li key={r.id}>
              {r.bodyPart}
              {r.note ? ` — ${r.note}` : ""}
            </li>
          ))
        )}
      </ul>

      <ModalShell open={addOpen} title={t("addTitle")} onClose={() => setAddOpen(false)}>
        <p className="mb-2 text-[13px]">{pendingPart}</p>
        <Field
          label={t("noteOptional")}
          preset="shortText"
          placeholder={t("noteOptional")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <ModalFooter
          onCancel={() => setAddOpen(false)}
          onSubmit={() => void confirmAdd()}
          submitLabel={tc("confirm")}
        />
      </ModalShell>

      <ModalShell open={!!removeRow} title={t("removeTitle")} onClose={() => setRemoveRow(null)}>
        <p className="text-[13px]">{removeRow?.bodyPart}</p>
        <ModalFooter
          onCancel={() => setRemoveRow(null)}
          onSubmit={() => void confirmRemove()}
          submitLabel={tc("delete")}
        />
      </ModalShell>
    </div>
  );
}
