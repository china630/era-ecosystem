"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  buildSatelliteSsoLaunchUrl,
  defaultSsoExpiresAt,
} from "@era/satellite-kit/auth/sso-launch";
import {
  hasIndustryModuleAccess,
  industryItemByVertical,
  satelliteUrlForItem,
} from "@era/satellite-kit/platform/industry-modules";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../../lib/auth-context";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useSubscription } from "../../../lib/subscription-context";
import { workspacePricingHref } from "../../../lib/workspace-access";

export default function IndustryVerticalPage() {
  const { vertical } = useParams<{ vertical: string }>();
  const router = useRouter();
  const t = useTranslations("industry");
  const { ready, user } = useRequireAuth();
  const { snapshot, loading } = useSubscription();
  const item = industryItemByVertical(String(vertical ?? ""));

  if (!ready || !user) return null;
  if (!item) {
    return (
      <p className="text-sm text-red-600">
        {t("unknownModule", { vertical: String(vertical) })}
      </p>
    );
  }

  const entitled = hasIndustryModuleAccess(snapshot, item.key);
  const readOnly = Boolean(snapshot?.readOnly);
  const satelliteUrl = satelliteUrlForItem(item);

  function openSatellite() {
    if (!satelliteUrl || !user?.email || !user.organizationId) return;
    const url = buildSatelliteSsoLaunchUrl(satelliteUrl, {
      email: user.email,
      fullName: user.email.split("@")[0] ?? "User",
      organizationId: user.organizationId,
      expiresAt: defaultSsoExpiresAt(),
      financeRole: user.role ?? "OWNER",
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <Link href="/workspace" className={SECONDARY_BUTTON_CLASS}>
        {t("workspace")}
      </Link>
      <section className={`${CARD_CONTAINER_CLASS} mt-6 p-8 text-center`}>
        <h1 className="text-lg font-semibold text-[#34495E]">{item.title}</h1>
        <p className="mt-2 text-sm text-[#7F8C8D]">{item.description}</p>
        {loading ? (
          <p className="mt-4 text-sm text-[#7F8C8D]">{t("loading")}</p>
        ) : readOnly ? (
          <>
            <p className="mt-4 text-sm text-amber-800">{t("trialExpired")}</p>
            <Link href="/settings/subscription" className={`${PRIMARY_BUTTON_CLASS} mt-4 inline-flex`}>
              {t("renew")}
            </Link>
          </>
        ) : entitled ? (
          satelliteUrl ? (
            <button
              type="button"
              className={`${PRIMARY_BUTTON_CLASS} mt-6`}
              onClick={openSatellite}
            >
              {t("openModule")}
            </button>
          ) : (
            <p className="mt-4 text-xs text-amber-700">
              {t("envHint", { env: item.satelliteUrlEnv })}
            </p>
          )
        ) : (
          <>
            <p className="mt-4 text-sm text-[#7F8C8D]">{t("notEntitled")}</p>
            <Link
              href={workspacePricingHref(item.slug)}
              className={`${PRIMARY_BUTTON_CLASS} mt-4 inline-flex`}
            >
              {t("addModule")}
            </Link>
            <button
              type="button"
              className={`${SECONDARY_BUTTON_CLASS} ml-2 mt-4`}
              onClick={() => router.push("/workspace")}
            >
              {t("backWorkspace")}
            </button>
          </>
        )}
      </section>
    </>
  );
}
