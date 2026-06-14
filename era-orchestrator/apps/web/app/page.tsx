"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "../lib/auth-context";

export default function HomeRedirectPage() {
  const router = useRouter();
  const { ready, token, user } = useAuth();
  const t = useTranslations("common");

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!user?.organizationId && !user?.isSuperAdmin) {
      router.replace("/organizations");
      return;
    }
    router.replace("/workspace");
  }, [ready, token, user?.organizationId, user?.isSuperAdmin, router]);

  return (
    <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
  );
}
