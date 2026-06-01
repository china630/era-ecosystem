"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

const threadFormId = "new-thread-form";
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
  const t = useTranslations("inbox");
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "instagram">("whatsapp");
  const [externalRef, setExternalRef] = useState("");
  const [preview, setPreview] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
      setMessage(t("contactRequired"));
      return;
    }
    setBusy(true);
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
      setMessage(t("threadCreated"));
      setModalOpen(false);
      await loadThreads();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
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
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex gap-2">
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
              {t("addThread")}
            </button>
            <Link href="/leads" className={PRIMARY_BUTTON_CLASS}>
              {t("pipeline")}
            </Link>
            <Link href="/" className={PRIMARY_BUTTON_CLASS}>
              {tNav("home")}
            </Link>
          </div>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-6`}>
        {message && <p className="text-[13px]">{message}</p>}

        <div>
          <h2 className="mb-2 text-[13px] font-semibold text-[#34495E]">{t("threads")}</h2>
          {loading ? (
            <p className="text-[13px] text-[#7F8C8D]">{tc("loading")}</p>
          ) : threads.length === 0 ? (
            <p className="text-[13px] text-[#7F8C8D]">{t("empty")}</p>
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
                      {thread.lead && ` · ${t("linked")}: ${thread.lead.title}`}
                    </div>
                  </div>
                  {!thread.lead && (
                    <Link
                      href={createLeadHref(thread)}
                      className="text-[12px] text-[#2980B9] underline"
                    >
                      {t("createLead")}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ModalShell
        open={modalOpen}
        title={t("newThread")}
        onClose={() => setModalOpen(false)}
        closeLabel={tc("close")}
        footer={
          <ModalFooter
            formId={threadFormId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel={t("addThread")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <form id={threadFormId} onSubmit={createThread} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("channel")}</label>
            <select
              className={MODAL_INPUT_CLASS}
              value={channel}
              onChange={(e) => setChannel(e.target.value as "whatsapp" | "instagram")}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("contactRef")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={externalRef}
              onChange={(e) => setExternalRef(e.target.value)}
              placeholder="+994… or @handle"
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("preview")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              placeholder="Last message preview…"
            />
          </div>
        </form>
      </ModalShell>
    </>
  );
}
