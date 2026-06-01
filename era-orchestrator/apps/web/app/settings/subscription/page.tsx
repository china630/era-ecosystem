"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { ShellHeader } from "../../../components/shell-header";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useSubscription } from "../../../lib/subscription-context";

export default function SubscriptionPage() {
  const { ready } = useRequireAuth();
  const { snapshot, loading } = useSubscription();
  const t = useTranslations("settings");
  const tSub = useTranslations("settings.subscription");

  if (!ready) return null;

  return (
    <>
      <ShellHeader />
      <Link href="/" className={SECONDARY_BUTTON_CLASS}>
        {t("home")}
      </Link>
      <h1 className="mt-4 text-xl font-semibold">{tSub("title")}</h1>
      <pre className={`${CARD_CONTAINER_CLASS} mt-4 overflow-auto p-4 text-xs`}>
        {loading ? tSub("loading") : JSON.stringify(snapshot, null, 2)}
      </pre>
    </>
  );
}
