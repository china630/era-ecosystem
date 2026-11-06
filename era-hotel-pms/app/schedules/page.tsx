"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageHeader } from "@era/satellite-kit/ui";

const DEPTS = [
  {
    href: "/hk/roster",
    key: "housekeeping" as const,
    hintKey: "housekeepingHint" as const,
  },
  {
    href: "/schedules/reception",
    key: "reception" as const,
    hintKey: "receptionOpsHint" as const,
  },
  {
    href: "/schedules/security",
    key: "security" as const,
    hintKey: "securityOpsHint" as const,
  },
  {
    href: "/schedules/engineering",
    key: "engineering" as const,
    hintKey: "engineeringOpsHint" as const,
  },
] as const;

export default function SchedulesHubPage() {
  const t = useTranslations("dutySchedules");

  return (
    <div className="space-y-4">
      <PageHeader title={t("hubTitle")} subtitle={t("hubSubtitle")} />
      <ul className="grid gap-3 sm:grid-cols-2 max-w-3xl">
        {DEPTS.map((d) => (
          <li key={d.href}>
            <Link
              href={d.href}
              className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-400 transition-colors"
            >
              <div className="font-medium text-slate-900">{t(d.key)}</div>
              <div className="text-sm text-slate-600 mt-1">{t(d.hintKey)}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
