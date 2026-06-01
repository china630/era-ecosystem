"use client";

import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type SatelliteNotificationBellLabels = {
  bellAria: string;
  title: string;
  empty: string;
  markAll: string;
  close: string;
};

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  link?: string | null;
  isRead?: boolean;
  createdAt?: string;
};

export type SatelliteNotificationBellProps = {
  labels: SatelliteNotificationBellLabels;
  /** Base path prefix, default "" → `/api/notifications` */
  apiPrefix?: string;
};

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export function SatelliteNotificationBell({
  labels,
  apiPrefix = "",
}: SatelliteNotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const base = apiPrefix.replace(/\/$/, "");

  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetch(`${base}/api/notifications/unread-count`, {
        credentials: "include",
      });
      if (!res.ok) {
        setUnread(0);
        return;
      }
      const j = (await safeJson(res)) as { count?: number };
      setUnread(typeof j?.count === "number" ? j.count : 0);
    } catch {
      setUnread(0);
    }
  }, [base]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${base}/api/notifications?page=1&pageSize=15&unreadOnly=false`,
        { credentials: "include" },
      );
      if (!res.ok) {
        setItems([]);
        return;
      }
      const j = (await safeJson(res)) as { items?: NotificationRow[] };
      setItems(Array.isArray(j?.items) ? j.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void refreshUnread();
    const id = window.setInterval(() => void refreshUnread(), 60_000);
    return () => window.clearInterval(id);
  }, [refreshUnread]);

  useEffect(() => {
    if (!open) return;
    void loadList();
  }, [open, loadList]);

  async function markRead(id: string) {
    try {
      await fetch(`${base}/api/notifications/${id}/read`, {
        method: "PATCH",
        credentials: "include",
      });
    } catch {
      /* ignore */
    }
    void refreshUnread();
    void loadList();
  }

  async function markAllRead() {
    try {
      await fetch(`${base}/api/notifications/read-all`, {
        method: "PATCH",
        credentials: "include",
      });
    } catch {
      /* ignore */
    }
    void refreshUnread();
    void loadList();
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#D5DADF] bg-white text-[#34495E] transition hover:border-[#2980B9]/40 hover:bg-[#EBF5FB]"
        aria-label={labels.bellAria}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E74C3C] px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[70] cursor-default"
            aria-label={labels.close}
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-[80] mt-2 w-[min(320px,calc(100vw-2rem))] rounded-xl border border-[#D5DADF] bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-[#D5DADF] px-3 py-2">
              <span className="text-[13px] font-semibold text-[#34495E]">{labels.title}</span>
              {unread > 0 ? (
                <button
                  type="button"
                  className="text-[12px] font-medium text-[#2980B9] hover:underline"
                  onClick={() => void markAllRead()}
                >
                  {labels.markAll}
                </button>
              ) : null}
            </div>
            <ul className="max-h-72 overflow-y-auto p-2">
              {loading ? (
                <li className="px-2 py-4 text-center text-[12px] text-[#7F8C8D]">…</li>
              ) : items.length === 0 ? (
                <li className="px-2 py-4 text-center text-[12px] text-[#7F8C8D]">{labels.empty}</li>
              ) : (
                items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`mb-1 w-full rounded-lg border border-[#D5DADF] px-2 py-2 text-left text-[12px] hover:bg-[#F8F9FA] ${n.isRead ? "opacity-70" : ""}`}
                      onClick={() => {
                        if (!n.isRead) void markRead(n.id);
                        if (n.link) window.location.href = n.link;
                      }}
                    >
                      <div className="font-medium text-[#34495E]">{n.title}</div>
                      <div className="text-[#7F8C8D]">{n.message}</div>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
