"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";

const LINKS = [
  { href: "/workspace/documents", key: "navRegister" },
  { href: "/workspace/documents/tasks", key: "navTasks" },
  { href: "/workspace/documents/routes", key: "navRoutes" },
  { href: "/workspace/documents/archive", key: "navArchive" },
] as const;

export function DocumentsNav() {
  const pathname = usePathname();
  const t = useTranslations("documentsOffice");
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const active =
          link.href === "/workspace/documents"
            ? pathname === link.href
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={SECONDARY_BUTTON_CLASS}
            aria-current={active ? "page" : undefined}
          >
            {t(link.key)}
          </Link>
        );
      })}
    </div>
  );
}
