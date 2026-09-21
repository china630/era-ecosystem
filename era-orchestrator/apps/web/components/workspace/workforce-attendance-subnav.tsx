"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  TAB_ITEM_ACTIVE_CLASS,
  TAB_ITEM_CLASS,
  TAB_STRIP_CLASS,
} from "@era/satellite-kit/ui";

const LINKS = [
  {
    href: "/workspace/workforce/attendance",
    exact: true,
    labelKey: "punchesTitle" as const,
  },
  {
    href: "/workspace/workforce/attendance/devices",
    exact: false,
    labelKey: "devicesTitle" as const,
  },
  {
    href: "/workspace/workforce/attendance/identities",
    exact: false,
    labelKey: "identitiesTitle" as const,
  },
];

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) {
    return pathname === href || pathname === `${href}/`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkforceAttendanceSubnav() {
  const pathname = usePathname() ?? "";
  const t = useTranslations("workforceAttendance");

  return (
    <nav className={TAB_STRIP_CLASS} aria-label={t("title")}>
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href, link.exact);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? TAB_ITEM_ACTIVE_CLASS : TAB_ITEM_CLASS}
            aria-current={active ? "page" : undefined}
          >
            {t(link.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
