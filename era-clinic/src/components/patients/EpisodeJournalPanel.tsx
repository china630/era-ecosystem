"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ModalShell,
  TEXT_MUTED_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { bakuDateTimeDisplay } from "@/lib/baku-day";

type JournalRow = {
  id: string;
  action: string;
  createdAt: string;
  userId?: string | null;
  summary: string;
  fields?: Array<{ key: string; from: string | null; to: string | null }>;
};

type Props = {
  episodeId: string;
  open: boolean;
  onClose: () => void;
};

export function EpisodeJournalPanel({ episodeId, open, onClose }: Props) {
  const t = useTranslations("patientRegistry");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<JournalRow[]>([]);

  const load = useCallback(async () => {
    if (!episodeId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/sanatorium/episodes/${episodeId}/journal?limit=100`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, t("episodeHistoryLoadFailed"));
        setRows([]);
        return;
      }
      const items = (data.data?.items ?? data.items ?? []) as JournalRow[];
      setRows(items);
    } finally {
      setLoading(false);
    }
  }, [episodeId, t]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <ModalShell
      open={open}
      title={t("episodeHistoryTitle")}
      onClose={onClose}
      closeLabel={tc("close")}
    >
      {loading ? (
        <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>
      ) : rows.length === 0 ? (
        <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{t("episodeHistoryEmpty")}</p>
      ) : (
        <ul className="max-h-[60vh] list-none space-y-3 overflow-y-auto text-sm">
          {rows.map((row) => (
            <li
              key={row.id}
              className="border-b border-slate-100 pb-2 last:border-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-[#2C3E50]">{row.action}</span>
                <span className={TEXT_MUTED_CLASS}>
                  {bakuDateTimeDisplay(row.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] text-slate-700">{row.summary}</p>
              {row.userId ? (
                <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{row.userId}</p>
              ) : null}
              {row.fields && row.fields.length > 0 ? (
                <ul className={`mt-1 text-[12px] ${TEXT_MUTED_CLASS}`}>
                  {row.fields.map((f) => (
                    <li key={`${row.id}-${f.key}`}>
                      {f.key}: {f.from ?? "—"} → {f.to ?? "—"}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
}
