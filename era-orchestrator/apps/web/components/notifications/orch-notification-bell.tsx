"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getOrchAccessToken, orchFetch } from "../../lib/orch-api";

type OutboxRow = {
  id: string;
  templateKey: string;
  status: string;
  createdAt: string;
  lastError?: string | null;
};

/** Finance-aligned bell — lists platform notification outbox for the active org. */
export function OrchNotificationBell() {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    const token = getOrchAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await orchFetch(
        "/platform/notifications/v1/outbox?limit=15&offset=0",
        { token },
      );
      if (!res.ok) {
        setItems([]);
        return;
      }
      const data = (await res.json()) as { items?: OutboxRow[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) void loadList();
  }, [open, loadList]);

  const unread = items.filter((i) => i.status !== "DELIVERED" && i.status !== "FAILED").length;

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#D5DADF] bg-white text-[#34495E] transition hover:border-[#2980B9]/40 hover:bg-[#2980B9]/10"
        aria-label={t("notificationsBellAria")}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" strokeWidth={2} aria-hidden />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className="absolute right-0 z-[120] mt-2 w-[min(100vw-1.5rem,22rem)] rounded-xl border border-[#D5DADF] bg-white shadow-xl"
          role="menu"
        >
          <div className="flex items-center justify-between border-b border-[#EBEDF0] px-3 py-2">
            <span className="text-sm font-semibold text-[#34495E]">
              {t("notificationsTitle")}
            </span>
            <Link
              href="/settings"
              className="text-xs font-medium text-[#2980B9] hover:underline"
              onClick={() => setOpen(false)}
            >
              {t("notificationsSettings")}
            </Link>
          </div>
          <div className="max-h-[min(70vh,320px)] overflow-y-auto">
            {loading ? (
              <div className="px-3 py-6 text-center text-sm text-[#7F8C8D]">…</div>
            ) : items.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-[#7F8C8D]">
                {t("notificationsEmpty")}
              </div>
            ) : (
              <ul className="divide-y divide-[#EBEDF0]">
                {items.map((n) => (
                  <li key={n.id} className="px-3 py-2.5">
                    <div className="text-sm font-semibold text-[#34495E]">
                      {n.templateKey}
                    </div>
                    <div className="mt-0.5 text-xs text-[#7F8C8D]">{n.status}</div>
                    <div className="mt-1 text-[10px] text-[#7F8C8D]">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
