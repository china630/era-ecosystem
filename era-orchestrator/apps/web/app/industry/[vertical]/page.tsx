"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { buildSatelliteSsoLaunchUrlFromTicket } from "@era/satellite-kit/auth/sso-launch";
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
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useSubscription } from "../../../lib/subscription-context";
import { workspacePricingHref } from "../../../lib/workspace-access";
import {
  fetchSatelliteLaunchUrl,
  fetchSatelliteSsoTicket,
  getOrchAccessToken,
} from "../../../lib/open-finance";

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

  const industry = item;
  const entitled = hasIndustryModuleAccess(snapshot, industry.key);
  const readOnly = Boolean(snapshot?.readOnly);

  function openSatellite() {
    if (!user?.email || !user.organizationId) return;
    const token = getOrchAccessToken();
    if (!token) return;
    const organizationId = user.organizationId;
    const popup = window.open("", "_blank");
    void (async () => {
      const fromRegistry = await fetchSatelliteLaunchUrl(token, industry.slug);
      const base = fromRegistry?.baseUrl ?? satelliteUrlForItem(industry);
      if (!base) {
        popup?.close();
        return;
      }
      const ticket = await fetchSatelliteSsoTicket(token, organizationId);
      if (!ticket) {
        popup?.close();
        return;
      }
      const url = buildSatelliteSsoLaunchUrlFromTicket(base, ticket);
      if (popup) popup.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
    })();
  }

  return (
    <>
      <Link href="/workspace" className={SECONDARY_BUTTON_CLASS}>
        {t("workspace")}
      </Link>
      <section className={`${CARD_CONTAINER_CLASS} mt-6 p-8 text-center`}>
        <h1 className="text-lg font-semibold text-[#34495E]">{industry.title}</h1>
        <p className="mt-2 text-sm text-[#7F8C8D]">{industry.description}</p>
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
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} mt-6`}
            onClick={openSatellite}
          >
            {t("openModule")}
          </button>
        ) : (
          <>
            <p className="mt-4 text-sm text-[#7F8C8D]">{t("notEntitled")}</p>
            <Link
              href={workspacePricingHref(industry.slug)}
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
