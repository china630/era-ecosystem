"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Locale } from "@era/i18n-common";
import { useAuth } from "../../lib/auth-context";
/**
 * Dual-purpose orch web `/`: authed → workspace/orgs; guests → `/{locale}` marketing shell.
 * Apex hosts redirect `/` in middleware; this page is for local/app hosts.
 */
export function HomePageClient({ initialLocale }: { initialLocale: Locale }) {
  const { ready, token, user } = useAuth();
  const router = useRouter();
  const t = useTranslations("common");

  useEffect(() => {
    if (!ready) return;
    if (token) {
      if (!user?.organizationId && !user?.isSuperAdmin) {
        router.replace("/organizations");
        return;
      }
      router.replace("/workspace");
      return;
    }
    router.replace(`/${initialLocale}`);
  }, [ready, token, user?.organizationId, user?.isSuperAdmin, initialLocale, router]);

  return <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>;
}
