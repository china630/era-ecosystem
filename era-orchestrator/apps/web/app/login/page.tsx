"use client";

import { Suspense, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { AuthLoginCard, buildAuthLoginLabels, parseApiError } from "@era/satellite-kit/ui";
import type { Locale } from "@era/i18n-common";
import { OrchLanguageSwitcher } from "../../components/locale/orch-language-switcher";
import { useAuth, type MembershipRow, type OrchUser } from "../../lib/auth-context";
import { orchFetch } from "../../lib/orch-api";

type PickerState = {
  token: string;
  user: OrchUser;
  memberships: MembershipRow[];
  refreshToken?: string;
};

function LoginForm() {
  const router = useRouter();
  const t = useTranslations("login");
  const tAuth = useTranslations("auth");
  const locale = useLocale() as Locale;
  const { login, token, ready, user } = useAuth();
  const tOrg = useTranslations("organizations");
  const tCommon = useTranslations("common");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    // Do not auto-redirect while a fresh multi-company login is choosing a
    // company (token stays null until a company is picked).
    if (!ready || !token || picker) return;
    if (!user?.organizationId && !user?.isSuperAdmin) {
      router.replace("/organizations");
      return;
    }
    router.replace("/workspace");
  }, [ready, token, user, router, picker]);

  if (ready && token && !picker) return null;

  async function pickCompany(organizationId: string) {
    if (!picker) return;
    setSwitchingId(organizationId);
    try {
      const res = await orchFetch("/auth/switch-organization", {
        method: "POST",
        token: picker.token,
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) {
        setError(tAuth("loginFailed"));
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken?: string;
        claims: {
          sub: string;
          email: string;
          organizationId: string;
          role: string;
          isSuperAdmin?: boolean;
        };
      };
      login(data.accessToken, {
        id: data.claims.sub,
        email: data.claims.email,
        organizationId: data.claims.organizationId,
        role: data.claims.role,
        isSuperAdmin: Boolean(data.claims.isSuperAdmin),
      }, data.refreshToken ?? picker.refreshToken);
      setPicker(null);
      router.replace("/workspace");
    } finally {
      setSwitchingId(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        setError(parseApiError(await res.text().catch(() => null), tAuth("loginFailed")));
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken?: string;
        user: { id: string; email: string; organizationId?: string | null };
        claims?: { isSuperAdmin?: boolean; role?: string };
      };
      const claims =
        data.claims ??
        (() => {
          try {
            return JSON.parse(atob(data.accessToken.split(".")[1] ?? "")) as {
              isSuperAdmin?: boolean;
              role?: string;
            };
          } catch {
            return {};
          }
        })();
      const nextUser: OrchUser = {
        id: data.user.id,
        email: data.user.email,
        organizationId: data.user.organizationId ?? null,
        role: claims.role ?? null,
        isSuperAdmin: Boolean(claims.isSuperAdmin),
      };

      // Onboarding routing by company count (0 / 1 / N). A multi-company user
      // must pick a company on every login via a blocking modal (like the tax
      // portal); a single-company user enters directly; a company-less user is
      // sent to the blocking onboarding.
      let memberships: MembershipRow[] = [];
      try {
        const memRes = await orchFetch("/memberships", { token: data.accessToken });
        if (memRes.ok) {
          memberships = (await memRes.json()) as MembershipRow[];
        }
      } catch {
        memberships = [];
      }

      if (memberships.length > 1) {
        // Defer login() until a company is picked so the redirect effect does
        // not fire and the modal can force a choice.
        setPicker({
          token: data.accessToken,
          user: nextUser,
          memberships,
          refreshToken: data.refreshToken,
        });
        return;
      }

      login(data.accessToken, nextUser, data.refreshToken);
      if (memberships.length === 1) {
        router.replace(nextUser.organizationId ? "/workspace" : "/organizations");
      } else if (memberships.length === 0) {
        router.replace(nextUser.isSuperAdmin ? "/workspace" : "/organizations");
      } else {
        router.replace(
          nextUser.organizationId || nextUser.isSuperAdmin ? "/workspace" : "/organizations",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  let demoHint: string | undefined;
  try {
    demoHint = t("demoHint");
  } catch {
    demoHint = undefined;
  }

  function roleLabel(role: string): string {
    try {
      return tOrg(`roles.${role.toLowerCase()}` as "roles.owner");
    } catch {
      return role;
    }
  }

  return (
    <>
      <AuthLoginCard
        locale={locale}
        localeControl={<OrchLanguageSwitcher />}
        labels={{
          ...buildAuthLoginLabels(tAuth, { emailMode: true }),
          loginTitle: t("title"),
        }}
        loginId={email}
        password={password}
        onLoginIdChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={onSubmit}
        busy={busy}
        error={error ?? undefined}
        subtitle={t("subtitle")}
        ssoHint={demoHint}
        emailMode
        registerHref="/register"
        registerOrgHref="/register-org"
        pricingHref="/pricing"
        faqHref="/help"
        termsHref="/terms"
        legalAppPrefix="ERA365"
      />
      {picker ? (
        <div
          className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-24"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#E1E5EA] bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[#34495E]">{tOrg("pickTitle")}</h2>
            <p className="mt-1 text-[13px] text-[#7F8C8D]">{tOrg("pickSubtitle")}</p>
            <ul className="mt-4 divide-y divide-[#EBEDF0]">
              {picker.memberships.map((m) => (
                <li key={m.organizationId} className="py-2 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    disabled={switchingId != null}
                    onClick={() => void pickCompany(m.organizationId)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[#F4F6F7] disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#34495E]">
                        {m.organizationName ?? m.organizationId}
                      </span>
                      <span className="block text-xs text-[#7F8C8D]">{roleLabel(m.role)}</span>
                    </span>
                    <span className="shrink-0 text-[13px] font-medium text-[#2980B9]">
                      {switchingId === m.organizationId ? tCommon("loading") : tOrg("openWorkspace")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function LoginPage() {
  const tCommon = useTranslations("common");

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#EBEDF0] p-8 text-[#7F8C8D]">
          {tCommon("loading")}
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
