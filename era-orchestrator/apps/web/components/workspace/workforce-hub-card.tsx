"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { workforceHubStatus } from "../../lib/workspace-access";
import type { SubscriptionSnapshot } from "../../lib/subscription-context";

export function WorkforceHubCard({
  snapshot,
}: {
  snapshot: SubscriptionSnapshot | null;
}) {
  const t = useTranslations("workspace.workforceHub");
  const status = workforceHubStatus(snapshot);

  const badge =
    status === "active"
      ? t("badgeActive")
      : status === "read_only"
        ? t("badgeReadOnly")
        : t("badgeNotSubscribed");

  return (
    <article className={`${CARD_CONTAINER_CLASS} flex flex-col p-4`}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#34495E]">{t("title")}</h2>
        <span className="shrink-0 rounded-full bg-[#EBEDF0] px-2 py-0.5 text-[11px] font-semibold text-[#475569]">
          {badge}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#7F8C8D]">{t("tagline")}</p>
      <ul className="mt-3 list-inside list-disc text-xs text-[#7F8C8D]">
        <li>{t("highlight1")}</li>
        <li>{t("highlight2")}</li>
        <li>{t("highlight3")}</li>
      </ul>
      <div className="mt-auto pt-4">
        {status === "active" ? (
          <Link href="/workspace/workforce/employments" className={PRIMARY_BUTTON_CLASS}>
            {t("open")}
          </Link>
        ) : (
          <Link href="/pricing#platform_workforce" className={PRIMARY_BUTTON_CLASS}>
            {t("addModule")}
          </Link>
        )}
      </div>
    </article>
  );
}
