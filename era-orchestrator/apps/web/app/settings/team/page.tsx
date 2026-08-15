"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, UserPlus, Users } from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { orchFetch } from "../../../lib/orch-api";
import { useAuth } from "../../../lib/auth-context";

function initials(source: string): string {
  const clean = source.trim();
  const name = clean.split("@")[0] ?? clean;
  const parts = name.split(/[.\-_\s]+/).filter(Boolean);
  const chars =
    parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2);
  return chars.toUpperCase();
}

type Member = {
  userId: string;
  email: string | null;
  role: string;
  isOwner: boolean;
};

type OrgInvite = {
  id: string;
  email: string;
  role: string;
  createdAt?: string;
};

type AccessRequest = {
  id: string;
  requester?: { email?: string | null } | null;
  message?: string | null;
  createdAt?: string;
};

const INVITE_ROLES = ["ADMIN", "ACCOUNTANT", "AUDITOR", "HR_MANAGER", "DIRECTOR", "USER"] as const;

export default function TeamSettingsPage() {
  const { ready } = useRequireAuth();
  const { token } = useAuth();
  const t = useTranslations("settings");
  const tTeam = useTranslations("settings.team");
  const tCommon = useTranslations("common");

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("USER");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const roleLabel = useCallback(
    (role: string): string => {
      try {
        return tTeam(`roles.${role.toLowerCase()}` as "roles.owner");
      } catch {
        return role;
      }
    },
    [tTeam],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const [memRes, invRes, reqRes] = await Promise.all([
      orchFetch("/team/members", { token }),
      orchFetch("/team/invites", { token }),
      orchFetch("/team/access-requests", { token }),
    ]);
    if (memRes.ok) setMembers((await memRes.json()) as Member[]);
    if (invRes.ok) setInvites((await invRes.json()) as OrgInvite[]);
    if (reqRes.ok) setRequests((await reqRes.json()) as AccessRequest[]);
    if (!memRes.ok && !invRes.ok && !reqRes.ok) {
      setError(tTeam("loadFailed"));
    }
  }, [token, tTeam]);

  useEffect(() => {
    if (ready && token) void load();
  }, [ready, token, load]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !inviteEmail.trim()) return;
    setBusy(true);
    setFormError(null);
    const res = await orchFetch("/team/invites", {
      method: "POST",
      token,
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(await res.text().catch(() => tTeam("actionFailed")));
      return;
    }
    setInviteOpen(false);
    setInviteEmail("");
    setInviteRole("USER");
    await load();
  }

  async function revokeInvite(id: string) {
    if (!token) return;
    const res = await orchFetch(`/team/invites/${id}/revoke`, { method: "POST", token });
    if (res.ok) await load();
  }

  async function decide(id: string, approve: boolean) {
    if (!token) return;
    const path = approve
      ? `/team/access-requests/${id}/approve`
      : `/team/access-requests/${id}/decline`;
    const res = await orchFetch(path, {
      method: "POST",
      token,
      body: approve ? JSON.stringify({ role: "USER" }) : undefined,
    });
    if (!res.ok) {
      setError(await res.text().catch(() => tTeam("actionFailed")));
      return;
    }
    await load();
  }

  if (!ready) return null;

  return (
    <>
      <Link href="/workspace" className={`${SECONDARY_BUTTON_CLASS} mb-4 inline-flex`}>
        {t("workspace")}
      </Link>
      <PageHeader
        title={tTeam("title")}
        subtitle={tTeam("subtitle")}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => {
              setFormError(null);
              setInviteOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {tTeam("invite")}
          </button>
        }
      />

      {error ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        <section className={`${CARD_CONTAINER_CLASS} overflow-hidden`}>
          <div className="flex items-center gap-2 border-b border-[#EBEDF0] px-4 py-3">
            <Users className="h-4 w-4 text-[#2980B9]" aria-hidden />
            <h2 className="text-sm font-semibold text-[#34495E]">{tTeam("membersTitle")}</h2>
            <span className="ml-auto rounded-full bg-[#EBEDF0] px-2 py-0.5 text-[11px] font-medium text-[#475569] tabular-nums">
              {members.length}
            </span>
          </div>
          {members.length === 0 ? (
            <p className="p-4 text-sm text-[#7F8C8D]">{tTeam("noMembers")}</p>
          ) : (
            <ul className="divide-y divide-[#EBEDF0]">
              {members.map((m) => {
                const label = m.email ?? m.userId.slice(0, 8);
                return (
                  <li key={m.userId} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EBF5FB] text-xs font-semibold text-[#2980B9]">
                      {initials(label)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#34495E]">{label}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.isOwner ? (
                        <span className="rounded-full bg-[#EBF5FB] px-2 py-0.5 text-[11px] font-medium text-[#2980B9]">
                          {tTeam("ownerBadge")}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-[#EBEDF0] px-2 py-0.5 text-[11px] font-medium text-[#475569]">
                        {roleLabel(m.role)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={`${CARD_CONTAINER_CLASS} overflow-hidden`}>
          <div className="flex items-center gap-2 border-b border-[#EBEDF0] px-4 py-3">
            <UserPlus className="h-4 w-4 text-[#2980B9]" aria-hidden />
            <h2 className="text-sm font-semibold text-[#34495E]">{tTeam("invitesTitle")}</h2>
            <span className="ml-auto rounded-full bg-[#EBEDF0] px-2 py-0.5 text-[11px] font-medium text-[#475569] tabular-nums">
              {invites.length}
            </span>
          </div>
          {invites.length === 0 ? (
            <p className="p-4 text-sm text-[#7F8C8D]">{tTeam("noInvites")}</p>
          ) : (
            <ul className="divide-y divide-[#EBEDF0]">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#34495E]">{inv.email}</p>
                    <p className="text-xs text-[#7F8C8D]">{roleLabel(inv.role)}</p>
                  </div>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => void revokeInvite(inv.id)}
                  >
                    {tTeam("revoke")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${CARD_CONTAINER_CLASS} overflow-hidden`}>
          <div className="flex items-center gap-2 border-b border-[#EBEDF0] px-4 py-3">
            <h2 className="text-sm font-semibold text-[#34495E]">{tTeam("requestsTitle")}</h2>
            <span className="ml-auto rounded-full bg-[#EBEDF0] px-2 py-0.5 text-[11px] font-medium text-[#475569] tabular-nums">
              {requests.length}
            </span>
          </div>
          {requests.length === 0 ? (
            <p className="p-4 text-sm text-[#7F8C8D]">{tTeam("noPending")}</p>
          ) : (
            <ul className="divide-y divide-[#EBEDF0]">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#34495E]">
                      {r.requester?.email ?? r.id}
                    </p>
                    {r.message ? <p className="text-xs text-[#7F8C8D]">{r.message}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={PRIMARY_BUTTON_CLASS}
                      onClick={() => void decide(r.id, true)}
                    >
                      {tTeam("approve")}
                    </button>
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      onClick={() => void decide(r.id, false)}
                    >
                      {tTeam("decline")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ModalShell
        open={inviteOpen}
        title={tTeam("inviteTitle")}
        subtitle={tTeam("inviteSubtitle")}
        onClose={() => setInviteOpen(false)}
        closeLabel={tCommon("close")}
      >
        <form onSubmit={(e) => void sendInvite(e)} className="grid gap-3">
          <label className="block text-[13px] font-medium text-[#34495E]">
            {tTeam("inviteEmail")}
            <input
              type="email"
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {tTeam("inviteRole")}
            <select
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              {INVITE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </label>
          {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setInviteOpen(false)}
            >
              {tCommon("cancel")}
            </button>
            <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
              {busy ? tCommon("loading") : tTeam("send")}
            </button>
          </div>
        </form>
      </ModalShell>
    </>
  );
}
