"use client";

import { useEffect, useMemo, useState } from "react";
import { useClinicAuth } from "@/hooks/useClinicAuth";
import { useTranslations } from "next-intl";

type ProcOrder = {
  id: string;
  accessCode?: string | null;
  procedureName: string;
  procedureCode: string;
  scheduledAt: string;
  status: string;
  patientRef: { id: string; fullName: string; refCode?: string };
  checkInOpen?: boolean;
  checkInDeadline?: string;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function CheckInPage() {
  const t = useTranslations("common");
  const { auth } = useClinicAuth();

  const [code, setCode] = useState("");
  const [orders, setOrders] = useState<ProcOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<"ok" | "err">("ok");

  const dateParam = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Baku",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }, []);

  useEffect(() => {
    if (!auth?.role) return;
    if (auth.checkInMode !== "CODE") {
      setLoading(false);
      return;
    }

    setLoading(true);
    void fetch(`/api/procedures?date=${encodeURIComponent(dateParam)}&status=SCHEDULED`)
      .then(async (res) => {
        const d = await res.json();
        return res.ok ? d : { error: d };
      })
      .then((d) => {
        if (!d?.orders) return;
        setOrders(d.orders as ProcOrder[]);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [auth?.role, auth?.checkInMode, dateParam]);

  async function submit() {
    setMsg(null);
    const trimmed = code.trim();
    if (!trimmed) return;

    const res = await fetch("/api/procedures/check-in-by-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: trimmed }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg("Checked in");
      setMsgTone("ok");
      setCode("");
      // reload just the displayed list
      const d2 = await fetch(`/api/procedures?date=${encodeURIComponent(dateParam)}&status=SCHEDULED`).then(
        (r) => r.json(),
      );
      if (d2?.orders) setOrders(d2.orders as ProcOrder[]);
    } else {
      setMsg(d?.message ?? "Check-in failed");
      setMsgTone("err");
    }
  }

  if (!auth?.checkInMode) return null;
  if (auth.checkInMode !== "CODE") {
    return <div className="p-4">Check-in by code is available only in CODE mode.</div>;
  }

  return (
    <div className="p-4">
      <h1 className="mb-3 text-lg font-semibold">Check-in (CODE)</h1>

      <div className="flex items-end gap-3">
        <div className="flex flex-col">
          <label className="text-sm opacity-80">Access code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-48 rounded border px-2 py-1"
            placeholder="5-char code"
            autoCapitalize="characters"
            autoCorrect="off"
          />
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          className="rounded bg-blue-600 px-3 py-1 text-white"
        >
          {t("save")}
        </button>
      </div>

      {msg ? (
        <p className={`mt-3 text-sm ${msgTone === "ok" ? "text-green-700" : "text-red-700"}`}>{msg}</p>
      ) : null}

      <div className="mt-4">
        {loading ? (
          <p className="text-sm opacity-80">Loading...</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-1 pr-2">Time</th>
                <th className="py-1 pr-2">Code</th>
                <th className="py-1 pr-2">Patient</th>
                <th className="py-1 pr-2">Procedure</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-2 opacity-80">
                    No scheduled procedures
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="py-2 pr-2">{formatTime(o.scheduledAt)}</td>
                    <td className="py-2 pr-2">
                      <button
                        type="button"
                        onClick={() => setCode((o.accessCode ?? "").toUpperCase())}
                        className="rounded border px-2 py-0.5 text-xs hover:bg-gray-50"
                        disabled={!o.accessCode}
                      >
                        {o.accessCode ?? "—"}
                      </button>
                    </td>
                    <td className="py-2 pr-2">{o.patientRef.fullName}</td>
                    <td className="py-2 pr-2">{o.procedureName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

