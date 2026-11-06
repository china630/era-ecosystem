"use client";

import { FormEvent, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  PageHeader,
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useAuth } from "../../../lib/auth-context";

type DraftThread = {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
};

/**
 * Comms Hub (CP-COMMS-01) — messaging shell.
 * Local drafts only; not satellite integration channels.
 * ADR: docs/adr/cp-comms-hub-messaging.md
 */
export default function CommsHubPage() {
  const { ready } = useRequireAuth();
  const { user } = useAuth();
  const t = useTranslations("commsHub");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [threads, setThreads] = useState<DraftThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => threads.find((x) => x.id === selectedId) ?? null,
    [threads, selectedId],
  );

  if (!ready || !user) return null;

  function onCompose(e: FormEvent) {
    e.preventDefault();
    const s = subject.trim();
    const b = body.trim();
    if (!s || !b) return;
    const row: DraftThread = {
      id: `local-${Date.now()}`,
      subject: s,
      body: b,
      createdAt: new Date().toISOString(),
    };
    setThreads((prev) => [row, ...prev]);
    setSelectedId(row.id);
    setSubject("");
    setBody("");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <p className="text-xs text-[#7F8C8D]">
        {t("scopedOrg")}{" "}
        <span className="font-mono text-[12px] text-[#34495E]">
          {user.organizationId}
        </span>
      </p>
      <p className="text-sm text-[#5D6D7E]">{t("shellHint")}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="text-sm font-semibold text-[#34495E]">{t("inboxTitle")}</h2>
          <ul className="space-y-2">
            {threads.map((th) => (
              <li key={th.id}>
                <button
                  type="button"
                  className={`${GHOST_BUTTON_CLASS} w-full justify-start text-left ${
                    selectedId === th.id ? "ring-1 ring-[#3498DB]" : ""
                  }`}
                  onClick={() => setSelectedId(th.id)}
                >
                  <span className="block truncate font-medium text-[#34495E]">
                    {th.subject}
                  </span>
                  <span className="block truncate text-xs text-[#7F8C8D]">
                    {th.body}
                  </span>
                </button>
              </li>
            ))}
            {threads.length === 0 ? (
              <li className="text-sm text-[#7F8C8D]">{t("inboxEmpty")}</li>
            ) : null}
          </ul>
          {selected ? (
            <div className="border-t border-[#ECF0F1] pt-3 text-sm text-[#5D6D7E]">
              <p className="font-medium text-[#34495E]">{selected.subject}</p>
              <p className="mt-1 whitespace-pre-wrap">{selected.body}</p>
            </div>
          ) : null}
        </section>

        <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="text-sm font-semibold text-[#34495E]">{t("composeTitle")}</h2>
          <form className="space-y-3" onSubmit={onCompose}>
            <label className="block space-y-1 text-sm">
              <span className="text-[#5D6D7E]">{t("subjectLabel")}</span>
              <input
                className="w-full rounded border border-[#D5D8DC] px-3 py-2 text-[#34495E]"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-[#5D6D7E]">{t("bodyLabel")}</span>
              <textarea
                className="min-h-[120px] w-full rounded border border-[#D5D8DC] px-3 py-2 text-[#34495E]"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={4000}
              />
            </label>
            <button type="submit" className={PRIMARY_BUTTON_CLASS}>
              {t("composeSubmit")}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
