"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type InboxThread = {
  id: string;
  channel: string;
  externalRef: string;
  preview?: string | null;
  lastMessageAt: string;
  lead?: { id: string; title: string; contactRef: string } | null;
};

export default function InboxPage() {
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "instagram">("whatsapp");
  const [externalRef, setExternalRef] = useState("");
  const [preview, setPreview] = useState("");

  async function loadThreads() {
    setLoading(true);
    try {
      const res = await fetch("/api/inbox");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load inbox");
      setThreads(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadThreads();
  }, []);

  async function createThread(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!externalRef.trim()) {
      setMessage("Contact reference required");
      return;
    }
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          externalRef: externalRef.trim(),
          preview: preview.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create thread");
      setExternalRef("");
      setPreview("");
      setMessage("Thread stub created (metadata only — no live API)");
      await loadThreads();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    }
  }

  function createLeadHref(thread: InboxThread) {
    const params = new URLSearchParams({
      channel: thread.channel,
      contactRef: thread.externalRef,
    });
    return `/leads?${params.toString()}`;
  }

  return (
    <>
      <PageHeader
        title="Channel inbox"
        subtitle="C2 — WA/IG metadata stub (no live messaging)"
        actions={
          <div className="flex gap-2">
            <Link href="/leads" className={PRIMARY_BUTTON_CLASS}>
              Pipeline
            </Link>
            <Link href="/" className={PRIMARY_BUTTON_CLASS}>
              Home
            </Link>
          </div>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-6`}>
        <form onSubmit={createThread} className="space-y-3 rounded border p-4">
          <h2 className="text-[13px] font-semibold text-[#34495E]">New thread stub</h2>
          <label className="flex items-center gap-2 text-[13px]">
            Channel
            <select
              className="rounded border px-2 py-1"
              value={channel}
              onChange={(e) =>
                setChannel(e.target.value as "whatsapp" | "instagram")
              }
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
            </select>
          </label>
          <label className="block text-[13px]">
            Contact ref
            <input
              className="mt-1 block w-full rounded border px-2 py-1"
              value={externalRef}
              onChange={(e) => setExternalRef(e.target.value)}
              placeholder="+994… or @handle"
            />
          </label>
          <label className="block text-[13px]">
            Preview
            <input
              className="mt-1 block w-full rounded border px-2 py-1"
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              placeholder="Last message preview…"
            />
          </label>
          <button type="submit" className={PRIMARY_BUTTON_CLASS}>
            Add thread stub
          </button>
        </form>

        {message && <p className="text-[13px]">{message}</p>}

        <div>
          <h2 className="mb-2 text-[13px] font-semibold text-[#34495E]">Threads</h2>
          {loading ? (
            <p className="text-[13px] text-[#7F8C8D]">Loading…</p>
          ) : threads.length === 0 ? (
            <p className="text-[13px] text-[#7F8C8D]">No inbox threads yet.</p>
          ) : (
            <ul className="space-y-2">
              {threads.map((thread) => (
                <li
                  key={thread.id}
                  className="flex items-start justify-between rounded border p-3 text-[13px]"
                >
                  <div>
                    <div className="font-medium uppercase text-[#7F8C8D]">
                      {thread.channel}
                    </div>
                    <div>{thread.externalRef}</div>
                    {thread.preview && (
                      <p className="mt-1 text-[#7F8C8D]">{thread.preview}</p>
                    )}
                    <div className="mt-1 text-[11px] text-[#7F8C8D]">
                      {new Date(thread.lastMessageAt).toLocaleString()}
                      {thread.lead && ` · linked: ${thread.lead.title}`}
                    </div>
                  </div>
                  {!thread.lead && (
                    <Link
                      href={createLeadHref(thread)}
                      className="text-[12px] text-[#2980B9] underline"
                    >
                      Create lead
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
