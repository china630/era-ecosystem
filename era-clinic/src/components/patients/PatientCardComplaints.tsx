"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  FieldTextarea,
  LINK_ACCENT_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";

import {
  authorLabelFrom,
} from "@/domain/staff/practitioner-label";

type Row = {
  id: string;
  text: string;
  recordedAt: string;
  recordedByPractitioner?: { fullName: string; specialty: string | null } | null;
};

type Props = {
  patientRefId: string;
  episodeId?: string | null;
  readOnly?: boolean;
  onChanged?: () => void;
  /** Day-1 package open result from complaint POST (toast on card). */
  onDay1Program?: (payload: unknown) => void;
};

export function PatientCardComplaints({
  patientRefId,
  episodeId,
  readOnly = false,
  onChanged,
  onDay1Program,
}: Props) {
  const t = useTranslations("patientCard");
  const tc = useTranslations("common");
  const [items, setItems] = useState<Row[]>([]);
  const [resolvedEpisodeId, setResolvedEpisodeId] = useState<string | null>(
    episodeId ?? null,
  );
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const q = episodeId ? `?episode=${encodeURIComponent(episodeId)}` : "";
    const res = await fetch(`/api/patients/${patientRefId}/complaints${q}`);
    if (res.ok) {
      const raw = await res.json();
      const row = raw.data ?? raw;
      setItems(Array.isArray(row.items) ? row.items : []);
      setResolvedEpisodeId(
        typeof row.episodeId === "string" ? row.episodeId : episodeId ?? null,
      );
    } else {
      setItems([]);
      setResolvedEpisodeId(episodeId ?? null);
    }
    setLoading(false);
  }, [patientRefId, episodeId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setText("");
    setMsg("");
    setOpen(true);
  }

  function openEdit(row: Row) {
    setEditingId(row.id);
    setText(row.text);
    setMsg("");
    setOpen(true);
  }

  async function save() {
    if (!text.trim()) return;
    setBusy(true);
    setMsg("");
    if (editingId) {
      const res = await fetch(`/api/patients/${patientRefId}/complaints`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, text: text.trim() }),
      });
      setBusy(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg(data.error ?? tc("failed"));
        return;
      }
    } else {
      if (!resolvedEpisodeId) return;
      const res = await fetch(
        `/api/patients/${patientRefId}/complaints?episode=${encodeURIComponent(resolvedEpisodeId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim(), episodeId: resolvedEpisodeId }),
        },
      );
      setBusy(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg(data.error ?? tc("failed"));
        return;
      }
      const data = await res.json().catch(() => ({}));
      const day1 = data.day1Program ?? data.data?.day1Program;
      if (day1) onDay1Program?.(day1);
    }
    setOpen(false);
    setEditingId(null);
    setText("");
    await load();
    onChanged?.();
  }

  async function remove(id: string) {
    const res = await fetch(
      `/api/patients/${patientRefId}/complaints?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      await load();
      onChanged?.();
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          {t("complaintsTitle")}
        </h2>
        {!readOnly && resolvedEpisodeId ? (
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            {t("addComplaint")}
          </button>
        ) : null}
      </div>
      <div className={`${CARD_CONTAINER_CLASS} space-y-2 p-4`}>
        {loading ? (
          <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>
        ) : !resolvedEpisodeId ? (
          <p className={`text-sm ${TEXT_MUTED_CLASS}`}>
            {t("complaintsNoEpisode")}{" "}
            <Link href="/sanatorium" className={LINK_ACCENT_CLASS}>
              {t("diagnosesOpenSanatorium")}
            </Link>
          </p>
        ) : (
          <ul className="list-none space-y-3 text-sm">
            {items.map((c) => {
              const author = authorLabelFrom(c.recordedByPractitioner ?? null);
              return (
                <li key={c.id} className="border-b border-slate-100 pb-2 last:border-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span>{c.text}</span>
                    {!readOnly ? (
                      <>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={tc("edit")}
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="h-4 w-4 text-[#2980B9]" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={tc("delete")}
                          onClick={() => void remove(c.id)}
                        >
                          <Trash2 className="h-4 w-4 text-[#E74C3C]" aria-hidden />
                        </button>
                      </>
                    ) : null}
                  </div>
                  {author ? (
                    <p className={`mt-0.5 text-[12px] ${TEXT_MUTED_CLASS}`}>{author}</p>
                  ) : null}
                </li>
              );
            })}
            {items.length === 0 ? (
              <li className={TEXT_MUTED_CLASS}>—</li>
            ) : null}
          </ul>
        )}
        {msg ? <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{msg}</p> : null}
      </div>
      <ModalShell
        open={open}
        title={editingId ? tc("edit") : t("addComplaint")}
        onClose={() => setOpen(false)}
      >
        <FieldTextarea
          label={t("complaintsTitle")}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <ModalFooter
          onCancel={() => setOpen(false)}
          onSubmit={() => void save()}
          busy={busy}
          submitLabel={tc("save")}
        />
      </ModalShell>
    </section>
  );
}
