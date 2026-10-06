"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { useSubscription } from "../../lib/subscription-context";
import { enableWorkforceModule } from "../../lib/workforce-fetch";
import {
  workforceFeatureForPath,
  workforcePackageRank,
  workforceUpgradeSlug,
} from "../../lib/workforce-packages";

/**
 * Shown when a workforce page receives PLATFORM_WORKFORCE_REQUIRED or
 * WORKFORCE_PACKAGE_REQUIRED. Missing hub offers enable (Essential).
 * A lower package offers the upgrade for this screen.
 */
export function WorkforceGate({
  onEnabled,
}: {
  onEnabled?: () => void | Promise<void>;
}) {
  const t = useTranslations("workforceGate");
  const pathname = usePathname() ?? "";
  const { snapshot, refresh } = useSubscription();
  const [enabling, setEnabling] = useState(false);
  const modules = snapshot?.activeModules ?? [];
  const rank = workforcePackageRank(modules);
  const feature = workforceFeatureForPath(pathname);
  const upgrade =
    rank > 0 && feature != null && !pathname.startsWith("/pricing");
  const upgradeSlug = feature ? workforceUpgradeSlug(feature) : "platform_workforce_pro";

  async function enable() {
    setEnabling(true);
    const ok = await enableWorkforceModule(
      upgrade ? upgradeSlug : "platform_workforce",
    );
    setEnabling(false);
    if (ok) {
      await refresh();
      await onEnabled?.();
    }
  }

  return (
    <div className={`${CARD_CONTAINER_CLASS} mx-auto mt-6 max-w-lg p-8 text-center`}>
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#EBF5FB]">
        <ShieldCheck className="h-6 w-6 text-[#2980B9]" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold text-[#34495E]">
        {upgrade ? t("upgradeTitle") : t("title")}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#7F8C8D]">
        {upgrade ? t("upgradeHint") : t("hint")}
      </p>
      <button
        type="button"
        className={`${PRIMARY_BUTTON_CLASS} mt-6`}
        disabled={enabling}
        onClick={() => void enable()}
      >
        {enabling ? t("enabling") : upgrade ? t("upgrade") : t("enable")}
      </button>
      <p className="mt-4 text-sm">
        <Link href={`/pricing#${upgradeSlug}`} className="text-[#2980B9] hover:underline">
          {t("compare")}
        </Link>
      </p>
      <p className="mt-2 text-sm">
        <Link href="/workspace" className="text-[#2980B9] hover:underline">
          {t("back")}
        </Link>
      </p>
    </div>
  );
}
