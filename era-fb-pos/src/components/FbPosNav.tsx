"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChefHat, LayoutDashboard, LayoutGrid, Receipt } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SIDEBAR_LINK_ACTIVE_CLASS, SIDEBAR_LINK_CLASS } from "@era/satellite-kit/ui";

const links: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/floor", label: "Floor", icon: LayoutGrid },
  { href: "/orders", label: "Orders", icon: Receipt },
  { href: "/kds", label: "KDS", icon: ChefHat },
  { href: "/calendar", label: "Reservations", icon: CalendarDays },
];

export default function FbPosNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap items-center gap-2 border-b border-[#D5DADF] pb-4">
      <span className="mr-4 text-[13px] font-semibold text-[#34495E]">ERA F&B POS</span>
      {links.map((l) => {
        const Icon = l.icon;
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={active ? SIDEBAR_LINK_ACTIVE_CLASS : SIDEBAR_LINK_CLASS}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
