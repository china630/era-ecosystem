"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useCreateOrganization } from "../../components/organizations/create-organization-context";
import { OrgCard } from "../../components/organizations/org-card";
import { useAuth } from "../../lib/auth-context";
import { orchFetch } from "../../lib/orch-api";
import { useRequireAuth } from "../../lib/use-require-auth";

type PendingInvite = {
  id: string;
  organizationId: string;
  organizationName: string | null;
  role: string;
};

export default function OrganizationsPage() {
  const router = useRouter();
  const { ready, user } = useRequireAuth();
  const { memberships, switchOrganization, token } = useAuth();
  const { openCreateOrganization } = useCreateOrganization();
  const t = useTranslations("organizations");
  const tCommon = useTranslations("common");

  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [invitesLoaded, setInvitesLoaded] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const roleLabel = useMemo(
    () =>
      (role: string): string => {
        const key = role.toLowerCase();
        try {
          return t(`roles.${key}` as "roles.owner");
        } catch {
          return role;
        }
      },
    [t],
  );

  // When the user has no company, first check for pending invitations so an
  // invited accountant can join without registering. Only company-less users
  // need this lookup.
  useEffect(() => {
    if (!ready || memberships.length > 0 || !token) {
      setInvitesLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await orchFetch("/v1/invites/pending", { token });
        const rows = res.ok ? ((await res.json()) as PendingInvite[]) : [];
        if (!cancelled) setInvites(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setInvites([]);
      } finally {
        if (!cancelled) setInvitesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, memberships.length, token]);

  // Company-less onboarding is blocking: auto-open the registration modal so the
  // user cannot proceed without creating a company — but only when there are no
  // pending invitations to accept. Super-admins manage the platform and are exempt.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!ready || !invitesLoaded) return;
    if (
      memberships.length === 0 &&
      invites.length === 0 &&
      !user?.isSuperAdmin &&
      !autoOpenedRef.current
    ) {
      autoOpenedRef.current = true;
      openCreateOrganization();
    }
  }, [
    ready,
    invitesLoaded,
    memberships.length,
    invites.length,
    user?.isSuperAdmin,
    openCreateOrganization,
  ]);

  const acceptInvite = useCallback(
    async (invite: PendingInvite) => {
      if (!token) return;
      setAcceptingId(invite.id);
      try {
        const res = await orchFetch(`/v1/invites/${invite.id}/accept`, {
          method: "POST",
          token,
        });
        if (!res.ok) return;
        await switchOrganization(invite.organizationId);
        router.push("/workspace");
      } finally {
        setAcceptingId(null);
      }
    },
    [token, switchOrganization, router],
  );

  async function openOrg(organizationId: string) {
    if (user?.organizationId !== organizationId) {
      await switchOrganization(organizationId);
    }
    router.push("/workspace");
  }

  if (!ready) {
    return <p className="text-sm text-[#7F8C8D]">{tCommon("loading")}</p>;
  }

  if (memberships.length === 0) {
    return (
      <div className="mx-auto max-w-lg">
        {invites.length > 0 ? (
          <div className={`${CARD_CONTAINER_CLASS} mb-4 p-6`}>
            <h2 className="text-base font-semibold text-[#34495E]">{t("invitesTitle")}</h2>
            <p className="mt-1 text-sm text-[#7F8C8D]">{t("invitesSubtitle")}</p>
            <ul className="mt-4 divide-y divide-[#EBEDF0]">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#34495E]">
                      {inv.organizationName ?? inv.organizationId}
                    </p>
                    <p className="text-xs text-[#7F8C8D]">{roleLabel(inv.role)}</p>
                  </div>
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={acceptingId != null}
                    onClick={() => void acceptInvite(inv)}
                  >
                    {acceptingId === inv.id ? tCommon("loading") : t("acceptInvite")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className={`${CARD_CONTAINER_CLASS} p-8 text-center`}>
          <h1 className="text-xl font-semibold text-[#34495E]">{t("emptyTitle")}</h1>
          <p className="mt-2 text-sm text-[#7F8C8D]">{t("emptyHint")}</p>
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} mt-6`}
            onClick={openCreateOrganization}
          >
            {t("createSubmit")}
          </button>
          <p className="mt-4 text-sm">
            <Link href="/register-org" className="text-[#2980B9] hover:underline">
              {t("fallbackPage")}
            </Link>
          </p>
          {invites.length === 0 ? (
            <p className="mt-6 border-t border-[#ECF0F1] pt-4 text-xs text-[#95A5A6]">
              {t("invitedHint")}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={openCreateOrganization}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {t("addOrg")}
          </button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {memberships.map((m) => (
          <OrgCard
            key={m.organizationId}
            membership={m}
            isCurrent={user?.organizationId === m.organizationId}
            roleLabel={roleLabel(m.role)}
            workspaceLabel={t("openWorkspace")}
            currentWorkspaceLabel={t("currentWorkspace")}
            onOpen={() => void openOrg(m.organizationId)}
          />
        ))}
      </div>
    </>
  );
}
