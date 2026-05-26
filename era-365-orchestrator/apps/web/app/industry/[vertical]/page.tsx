"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  buildSatelliteSsoLaunchUrl,
  defaultSsoExpiresAt,
  hasIndustryModuleAccess,
  industryItemByVertical,
  satelliteUrlForItem,
  type IndustryModuleKey,
} from "@era/satellite-kit";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useEarlyAccess } from "../../../components/early-access/early-access-context";
import { ShellHeader } from "../../../components/shell-header";
import { useAuth } from "../../../lib/auth-context";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useSubscription } from "../../../lib/subscription-context";

export default function IndustryVerticalPage() {
  const { vertical } = useParams<{ vertical: string }>();
  const router = useRouter();
  const { ready, user } = useRequireAuth();
  const { snapshot } = useSubscription();
  const { open: openEarlyAccess } = useEarlyAccess();
  const item = industryItemByVertical(String(vertical ?? ""));

  useEffect(() => {
    if (!ready || !item || !snapshot) return;
    if (!hasIndustryModuleAccess(snapshot, item.key)) {
      openEarlyAccess(item.key as IndustryModuleKey);
      router.replace("/");
    }
  }, [ready, item, snapshot, router, openEarlyAccess]);

  if (!ready || !user) return null;
  if (!item) {
    return <p className="text-sm text-red-600">Unknown module: {vertical}</p>;
  }

  const entitled = hasIndustryModuleAccess(snapshot, item.key);
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
      <ShellHeader />
      <Link href="/" className={SECONDARY_BUTTON_CLASS}>
        ← Home
      </Link>
      <section className={`${CARD_CONTAINER_CLASS} mt-6 p-8 text-center`}>
        <h1 className="text-lg font-semibold text-[#34495E]">{item.title}</h1>
        <p className="mt-2 text-sm text-[#7F8C8D]">{item.description}</p>
        {entitled ? (
          satelliteUrl ? (
            <button
              type="button"
              className={`${PRIMARY_BUTTON_CLASS} mt-6`}
              onClick={openSatellite}
            >
              Open module (SSO)
            </button>
          ) : (
            <p className="mt-4 text-xs text-amber-700">
              Set {item.satelliteUrlEnv} in environment
            </p>
          )
        ) : (
          <p className="mt-4 text-sm text-[#7F8C8D]">Module not entitled</p>
        )}
      </section>
    </>
  );
}
