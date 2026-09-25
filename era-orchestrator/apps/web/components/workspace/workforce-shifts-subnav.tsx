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
    href: "/workspace/workforce/shifts",
    exact: true,
    labelKey: "shiftTypesHeading" as const,
  },
  {
    href: "/workspace/workforce/shifts/cycles",
    exact: false,
    labelKey: "cyclesHeading" as const,
  },
  {
    href: "/workspace/workforce/shifts/brigades",
    exact: false,
    labelKey: "brigadesHeading" as const,
  },
  {
    href: "/workspace/workforce/shifts/assignments",
    exact: false,
    labelKey: "assignmentsHeading" as const,
  },
];

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) {
    return pathname === href || pathname === `${href}/`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkforceShiftsSubnav() {
  const pathname = usePathname() ?? "";
  const t = useTranslations("workforceRoster");

  return (
    <nav className={TAB_STRIP_CLASS} aria-label={t("shiftsTitle")}>
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
