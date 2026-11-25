"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type RingEvent = {
  id: string;
  fromNumber?: string | null;
  toNumber?: string | null;
  leadId?: string | null;
  status?: string;
};

/**
 * SSE subscriber for /api/realtime/calls — RINGING popup (TZ T-I16 / audit v2).
 */
export default function IncomingCallToast() {
  const t = useTranslations("callsRealtime");
  const [ring, setRing] = useState<RingEvent | null>(null);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }
    const es = new EventSource("/api/realtime/calls");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as {
          items?: RingEvent[];
        };
        const items = data.items ?? [];
        for (const item of items) {
          if (!item?.id || seen.current.has(item.id)) continue;
          if (item.status && item.status !== "RINGING") continue;
          seen.current.add(item.id);
          setRing(item);
          break;
        }
      } catch {
        /* ignore malformed SSE */
      }
    };
    es.onerror = () => {
      /* browser will retry EventSource */
    };
    return () => es.close();
  }, []);

  if (!ring) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed bottom-4 right-4 z-[100] max-w-sm rounded border border-[#D5DADF] bg-white p-4 shadow-lg"
    >
      <p className="text-sm font-semibold text-[#2C3E50]">{t("incoming")}</p>
      <p className="mt-1 text-sm text-[#7F8C8D]">
        {ring.fromNumber || ring.toNumber || t("unknown")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ring.leadId ? (
          <Link
            href={`/leads/${ring.leadId}`}
            className="rounded bg-[#2C3E50] px-3 py-1 text-xs text-white"
            onClick={() => setRing(null)}
          >
            {t("openLead")}
          </Link>
        ) : null}
        <button
          type="button"
          className="rounded border border-[#D5DADF] px-3 py-1 text-xs"
          onClick={() => setRing(null)}
        >
          {t("dismiss")}
        </button>
      </div>
    </div>
  );
}
