"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  FieldTextarea,
  LINK_ACCENT_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";

type Row = { id: string; text: string; recordedAt: string };

type Props = {
  patientRefId: string;
  episodeId?: string | null;
  readOnly?: boolean;
};

export function PatientCardComplaints({
  patientRefId,
  episodeId,
  readOnly = false,
}: Props) {
  const t = useTranslations("patientCard");
  const tc = useTranslations("common");
  const [items, setItems] = useState<Row[]>([]);
  const [resolvedEpisodeId, setResolvedEpisodeId] = useState<string | null>(
    episodeId ?? null,
  );
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
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

  async function add() {
    if (!text.trim() || !resolvedEpisodeId) return;
    setBusy(true);
    setMsg("");
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
    setOpen(false);
    setText("");
    await load();
  }

  async function remove(id: string) {
    const res = await fetch(
      `/api/patients/${patientRefId}/complaints?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (res.ok) await load();
  }

  return (
    <section className={`${CARD_CONTAINER_CLASS} space-y-2 p-4`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{t("complaintsTitle")}</h3>
        {!readOnly && resolvedEpisodeId ? (
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setOpen(true)}>
            {t("addComplaint")}
          </button>
        ) : null}
      </div>
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
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {items.map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline gap-2">
              <span>{c.text}</span>
              {!readOnly ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => void remove(c.id)}
                >
                  {tc("delete")}
                </button>
              ) : null}
            </li>
          ))}
          {items.length === 0 ? (
            <li className={`list-none ${TEXT_MUTED_CLASS}`}>—</li>
          ) : null}
        </ul>
      )}
      {msg ? <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{msg}</p> : null}
      <ModalShell open={open} title={t("addComplaint")} onClose={() => setOpen(false)}>
        <FieldTextarea
          label={t("complaintsTitle")}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <ModalFooter
          onCancel={() => setOpen(false)}
          onSubmit={() => void add()}
          busy={busy}
          submitLabel={tc("save")}
        />
      </ModalShell>
    </section>
  );
}
