"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  PageHeader,
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
} from "@era/satellite-kit/ui";
import { bakuDateTimeDisplay } from "@era/satellite-kit/time";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useAuth } from "../../../lib/auth-context";
import { getOrchAccessToken, orchFetch } from "../../../lib/orch-api";

type Recipient = { userId: string; email: string | null };

type ThreadListItem = {
  id: string;
  subject: string;
  authorUserId: string;
  updatedAt: string;
  createdAt: string;
  messageCount: number;
  lastMessage: { body: string; createdAt: string; authorUserId: string } | null;
  unread: boolean;
  readAt: string | null;
};

type ThreadDetail = {
  id: string;
  subject: string;
  authorUserId: string;
  messages: Array<{
    id: string;
    body: string;
    authorUserId: string;
    createdAt: string;
  }>;
  participants: Array<{ userId: string; readAt: string | null }>;
};

/**
 * Comms Hub (CP-COMMS-01) — org messaging inbox.
 * Not satellite integration channels (folio / settlement / revenue).
 * ADR: docs/adr/cp-comms-hub-messaging.md
 */
export default function CommsHubPage() {
  const { ready } = useRequireAuth();
  const { user, token } = useAuth();
  const t = useTranslations("commsHub");

  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const accessToken = () => getOrchAccessToken() ?? token;

  const loadThreads = useCallback(async () => {
    const access = accessToken();
    if (!access) return;
    const res = await orchFetch("/v1/comms/threads", { token: access }).catch(
      () => null,
    );
    if (!res?.ok) {
      setError(t("loadFailed"));
      setThreads([]);
      return;
    }
    const data = (await res.json()) as ThreadListItem[];
    setThreads(Array.isArray(data) ? data : []);
  }, [t, token]);

  const loadRecipients = useCallback(async () => {
    const access = accessToken();
    if (!access) return;
    const res = await orchFetch("/v1/comms/recipients", { token: access }).catch(
      () => null,
    );
    if (!res?.ok) {
      setError(t("membersLoadFailed"));
      return;
    }
    const data = (await res.json()) as Recipient[];
    setRecipients(Array.isArray(data) ? data : []);
  }, [t, token]);

  const openThread = useCallback(
    async (threadId: string) => {
      const access = accessToken();
      if (!access) return;
      setSelectedId(threadId);
      const res = await orchFetch(`/v1/comms/threads/${threadId}`, {
        token: access,
      }).catch(() => null);
      if (!res?.ok) {
        setError(t("loadFailed"));
        setDetail(null);
        return;
      }
      const data = (await res.json()) as ThreadDetail;
      setDetail(data);
      await orchFetch(`/v1/comms/threads/${threadId}/read`, {
        token: access,
        method: "POST",
        body: "{}",
      }).catch(() => null);
      await loadThreads();
    },
    [loadThreads, t, token],
  );

  useEffect(() => {
    if (!ready || !user) return;
    setLoading(true);
    void Promise.all([loadThreads(), loadRecipients()]).finally(() =>
      setLoading(false),
    );
  }, [ready, user, loadThreads, loadRecipients]);

  if (!ready || !user) return null;

  const otherRecipients = recipients.filter((r) => r.userId !== user.id);

  function toggleRecipient(userId: string) {
    setSelectedRecipients((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }

  async function onCompose(e: FormEvent) {
    e.preventDefault();
    const access = accessToken();
    if (!access) return;
    const s = subject.trim();
    const b = body.trim();
    if (!s || !b || selectedRecipients.length === 0) {
      setError(t("sendFailed"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await orchFetch("/v1/comms/threads", {
        token: access,
        method: "POST",
        body: JSON.stringify({
          subject: s,
          body: b,
          recipientUserIds: selectedRecipients,
        }),
      });
      if (!res.ok) {
        setError(t("sendFailed"));
        return;
      }
      const created = (await res.json()) as { id: string };
      setSubject("");
      setBody("");
      setSelectedRecipients([]);
      await loadThreads();
      if (created?.id) await openThread(created.id);
    } finally {
      setSaving(false);
    }
  }

  async function onReply(e: FormEvent) {
    e.preventDefault();
    const access = accessToken();
    if (!access || !selectedId) return;
    const b = replyBody.trim();
    if (!b) return;
    setSaving(true);
    setError(null);
    try {
      const res = await orchFetch(`/v1/comms/threads/${selectedId}/reply`, {
        token: access,
        method: "POST",
        body: JSON.stringify({ body: b }),
      });
      if (!res.ok) {
        setError(t("sendFailed"));
        return;
      }
      setReplyBody("");
      await openThread(selectedId);
    } finally {
      setSaving(false);
    }
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
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="text-sm font-semibold text-[#34495E]">
            {t("inboxTitle")}
          </h2>
          <ul className="space-y-2">
            {threads.map((th) => (
              <li key={th.id}>
                <button
                  type="button"
                  className={`${GHOST_BUTTON_CLASS} w-full justify-start text-left ${
                    selectedId === th.id ? "ring-1 ring-[#3498DB]" : ""
                  }`}
                  onClick={() => void openThread(th.id)}
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="block min-w-0 flex-1 truncate font-medium text-[#34495E]">
                      {th.subject}
                    </span>
                    {th.unread ? (
                      <span className="shrink-0 rounded-full bg-[#2980B9] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {t("unreadBadge")}
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-[#7F8C8D]">
                    {th.lastMessage?.body ?? ""}
                  </span>
                </button>
              </li>
            ))}
            {threads.length === 0 ? (
              <li className="text-sm text-[#7F8C8D]">{t("inboxEmpty")}</li>
            ) : null}
          </ul>

          {detail ? (
            <div className="space-y-3 border-t border-[#ECF0F1] pt-3">
              <p className="font-medium text-[#34495E]">{detail.subject}</p>
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm text-[#5D6D7E]">
                {detail.messages.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-lg border border-[#EBEDF0] bg-[#F8F9FA] px-3 py-2"
                  >
                    <p className="text-[11px] text-[#95A5A6]">
                      {m.authorUserId === user.id
                        ? t("authorYou")
                        : m.authorUserId.slice(0, 8)}
                      {" · "}
                      {bakuDateTimeDisplay(m.createdAt)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                  </li>
                ))}
              </ul>
              <form className="space-y-2" onSubmit={onReply}>
                <label className="block space-y-1 text-sm">
                  <span className="text-[#5D6D7E]">{t("replyLabel")}</span>
                  <textarea
                    className={`${MODAL_INPUT_CLASS} min-h-[80px] w-full`}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    maxLength={8000}
                  />
                </label>
                <button
                  type="submit"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={saving || !replyBody.trim()}
                >
                  {t("replySubmit")}
                </button>
              </form>
            </div>
          ) : (
            <p className="text-sm text-[#7F8C8D]">{t("threadEmpty")}</p>
          )}
        </section>

        <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="text-sm font-semibold text-[#34495E]">
            {t("composeTitle")}
          </h2>
          <form className="space-y-3" onSubmit={onCompose}>
            <fieldset className="space-y-2">
              <legend className="text-sm text-[#5D6D7E]">
                {t("recipientsLabel")}
              </legend>
              <p className="text-xs text-[#95A5A6]">{t("recipientsHint")}</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {otherRecipients.map((r) => (
                  <li key={r.userId}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[#34495E]">
                      <input
                        type="checkbox"
                        checked={selectedRecipients.includes(r.userId)}
                        onChange={() => toggleRecipient(r.userId)}
                      />
                      <span className="truncate">{r.email ?? r.userId}</span>
                    </label>
                  </li>
                ))}
                {otherRecipients.length === 0 ? (
                  <li className="text-sm text-[#7F8C8D]">
                    {t("membersLoadFailed")}
                  </li>
                ) : null}
              </ul>
            </fieldset>
            <label className="block space-y-1 text-sm">
              <span className="text-[#5D6D7E]">{t("subjectLabel")}</span>
              <input
                className={MODAL_INPUT_CLASS}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={256}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-[#5D6D7E]">{t("bodyLabel")}</span>
              <textarea
                className={`${MODAL_INPUT_CLASS} min-h-[120px] w-full`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={8000}
              />
            </label>
            <button
              type="submit"
              className={PRIMARY_BUTTON_CLASS}
              disabled={
                saving ||
                !subject.trim() ||
                !body.trim() ||
                selectedRecipients.length === 0
              }
            >
              {t("composeSubmit")}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
