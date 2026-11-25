"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { bakuDateTimeDisplay } from "@era/satellite-kit/time";

type Conversation = {
  id: string;
  channel: string;
  contactName?: string | null;
  contactPhone?: string | null;
  leadId?: string | null;
  status: string;
  unreadCount: number;
  lastMessageAt: string;
  lastInboundAt?: string | null;
};

type Message = {
  id: string;
  direction: "IN" | "OUT";
  text?: string | null;
  status: string;
  sentAt: string;
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

export default function InboxPage() {
  const t = useTranslations("inbox");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load");
      return;
    }
    setConversations(data.items ?? []);
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const res = await fetch(`/api/conversations/${id}/messages`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load messages");
      return;
    }
    setMessages(data.items ?? []);
  }, []);

  useEffect(() => {
    void loadConversations();
    const timer = setInterval(() => void loadConversations(), 5000);
    return () => clearInterval(timer);
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId);
    const timer = setInterval(() => void loadMessages(activeId), 5000);
    return () => clearInterval(timer);
  }, [activeId, loadMessages]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const windowFamily =
    active != null &&
    /whatsapp|wa_|wazzup|instagram|messenger|facebook|viber/i.test(
      active.channel,
    );
  // Match server: free-text needs lastInboundAt within 24h (null = outside).
  const outsideWindow =
    windowFamily &&
    (active?.lastInboundAt == null ||
      Date.now() - new Date(active.lastInboundAt).getTime() > WINDOW_MS);

  const [templateName, setTemplateName] = useState("hello_world");

  async function send(opts?: { asTemplate?: boolean }) {
    if (!activeId) return;
    if (outsideWindow && !opts?.asTemplate) {
      setError(t("outsideWindow"));
      return;
    }
    if (!opts?.asTemplate && !draft.trim()) return;
    const res = await fetch(`/api/conversations/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        opts?.asTemplate
          ? { type: "template", text: templateName, templateName }
          : { text: draft.trim() },
      ),
    });
    const data = (await res.json()) as { error?: string; code?: string };
    if (!res.ok) {
      setError(
        data.code === "OUTSIDE_WINDOW"
          ? t("outsideWindow")
          : (data.error ?? "Send failed"),
      );
      return;
    }
    setDraft("");
    await loadMessages(activeId);
    await loadConversations();
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3 p-4">
      <PageHeader title={t("title")} subtitle={t("subtitleLive")} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-12">
        <aside className={`md:col-span-3 overflow-auto ${CARD_CONTAINER_CLASS}`}>
          <ul className="space-y-2">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`w-full rounded border px-2 py-2 text-left text-sm ${
                    activeId === c.id ? "border-[var(--era-accent)]" : ""
                  }`}
                  onClick={() => setActiveId(c.id)}
                >
                  <div className="font-medium">
                    {c.contactName || c.contactPhone || c.channel}
                    {c.unreadCount > 0 ? ` (${c.unreadCount})` : ""}
                  </div>
                  <div className="text-xs text-[var(--era-muted)]">
                    {bakuDateTimeDisplay(c.lastMessageAt)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className={`md:col-span-6 flex min-h-0 flex-col ${CARD_CONTAINER_CLASS}`}>
          <div className="min-h-0 flex-1 space-y-2 overflow-auto">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[80%] rounded px-3 py-2 text-sm ${
                  m.direction === "OUT" ? "ml-auto bg-[var(--era-accent-soft)]" : "bg-[var(--era-surface-2)]"
                }`}
              >
                <div>{m.text}</div>
                <div className="text-[10px] text-[var(--era-muted)]">
                  {m.status} · {bakuDateTimeDisplay(m.sentAt)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className={MODAL_INPUT_CLASS}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={outsideWindow ? t("templateOnly") : t("typeMessage")}
              disabled={!activeId || outsideWindow}
            />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={!activeId || outsideWindow}
              onClick={() => void send()}
            >
              {t("send")}
            </button>
            {outsideWindow ? (
              <>
                <input
                  className={MODAL_INPUT_CLASS}
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder={t("templateName")}
                  disabled={!activeId}
                />
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={!activeId || !templateName.trim()}
                  onClick={() => void send({ asTemplate: true })}
                >
                  {t("sendTemplate")}
                </button>
              </>
            ) : null}
          </div>
        </section>

        <aside className={`md:col-span-3 ${CARD_CONTAINER_CLASS}`}>
          {active?.leadId ? (
            <div className="space-y-2 text-sm">
              <div className="font-medium">{t("leadCard")}</div>
              <Link className="text-[var(--era-accent)] underline" href={`/leads/${active.leadId}`}>
                {active.leadId}
              </Link>
              <div>
                {t("channel")}: {active.channel}
              </div>
              <div>
                {t("status")}: {active.status}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--era-muted)]">{t("selectConversation")}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
