"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays, ChefHat, LayoutDashboard, LayoutGrid, Receipt, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SIDEBAR_LINK_ACTIVE_CLASS, SIDEBAR_LINK_CLASS } from "@era/satellite-kit/ui";

const linkKeys = [
  { href: "/", key: "dashboard", icon: LayoutDashboard },
  { href: "/floor", key: "floor", icon: LayoutGrid },
  { href: "/orders", key: "orders", icon: Receipt },
  { href: "/kds", key: "kds", icon: ChefHat },
  { href: "/admin/menu", key: "menu", icon: UtensilsCrossed },
  { href: "/admin/integration", key: "integration", icon: Receipt },
  { href: "/calendar", key: "calendar", icon: CalendarDays },
] as const;

export default function FbPosNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav className="mb-6 flex flex-wrap items-center gap-2 border-b border-[#D5DADF] pb-4">
      <span className="mr-4 text-[13px] font-semibold text-[#34495E]">{t("brand")}</span>
      {linkKeys.map((l) => {
        const Icon = l.icon as LucideIcon;
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={active ? SIDEBAR_LINK_ACTIVE_CLASS : SIDEBAR_LINK_CLASS}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {t(l.key)}
          </Link>
        );
      })}
    </nav>
  );
}
