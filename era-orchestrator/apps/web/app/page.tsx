"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "../lib/auth-context";
import { LandingPageView } from "../components/landing/landing-page-view";

/**
 * Hub home: guests see marketing landing; authenticated users go to workspace / orgs.
 */
export default function HomePage() {
  const { ready, token, user } = useAuth();
  const router = useRouter();
  const t = useTranslations("common");

  useEffect(() => {
    if (!ready) return;
    if (!token) return;
    if (!user?.organizationId && !user?.isSuperAdmin) {
      router.replace("/organizations");
      return;
    }
    router.replace("/workspace");
  }, [ready, token, user?.organizationId, user?.isSuperAdmin, router]);

  if (!ready || token) {
    return <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>;
  }

  return <LandingPageView initialLocale="az" />;
}
