"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { EraOpsNavItem, EraOpsNavSection } from "./era-ops-types";
import { SIDEBAR_LINK_ACTIVE_CLASS, SIDEBAR_LINK_CLASS } from "./design-system";

function NavLink({ item }: { item: EraOpsNavItem }) {
  const Icon = item.icon;
  const className = item.active ? SIDEBAR_LINK_ACTIVE_CLASS : SIDEBAR_LINK_CLASS;
  const content = (
    <>
      {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
      <span className="truncate">{item.label}</span>
    </>
  );

  if (item.onClick) {
    return (
      <button type="button" onClick={item.onClick} className={`${className} w-full`}>
        {content}
      </button>
    );
  }

  if (item.external && item.href) {
    return (
      <a
        href={item.href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
      >
        {content}
      </a>
    );
  }

  if (!item.href) return null;

  return (
    <Link href={item.href} className={className}>
      {content}
    </Link>
  );
}

function CollapsibleSection({
  section,
  pathname,
  resolveActive,
}: {
  section: EraOpsNavSection;
  pathname: string;
  resolveActive: (pathname: string, href: string) => boolean;
}) {
  const visibleItems = section.items.filter((item) => !item.hidden);
  if (visibleItems.length === 0) return null;

  if (section.flat && visibleItems.length === 1) {
    const item = visibleItems[0]!;
    const active =
      item.active ??
      (item.href ? resolveActive(pathname, item.href) : false);
    return <NavLink item={{ ...item, active }} />;
  }

  const sectionActive = visibleItems.some(
    (item) => item.active ?? (item.href ? resolveActive(pathname, item.href) : false),
  );
  const [open, setOpen] = useState(sectionActive);
  const Icon = section.icon;

  useEffect(() => {
    if (sectionActive) setOpen(true);
  }, [sectionActive]);

  return (
    <div className="flex flex-col gap-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition",
          sectionActive
            ? "border-[#2980B9]/30 bg-[#EBF5FB] text-[#34495E] shadow-sm"
            : "border-transparent text-[#7F8C8D] hover:border-[#D5DADF] hover:bg-[#F8F9FA]",
        ].join(" ")}
      >
        {Icon ? (
          <Icon
            className={`h-4 w-4 shrink-0 ${sectionActive ? "text-[#2980B9]" : "text-[#7F8C8D]"}`}
            aria-hidden
          />
        ) : null}
        <span className="flex-1 truncate text-[13px] font-semibold">{section.title}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-[#BDC3C7]" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-[#BDC3C7]" aria-hidden />
        )}
      </button>
      {open ? (
        <div className="ml-2 mt-1 flex flex-col gap-0.5 border-l-2 border-[#ECF0F1] pl-2">
          {visibleItems.map((item) => (
            <NavLink key={item.id ?? item.href ?? item.label} item={item} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function EraOpsSidebarSections({
  sections,
  topItems = [],
  resolveActive,
}: {
  sections: EraOpsNavSection[];
  /** Standalone links above collapsible sections (e.g. Finance-style Home / Əsas). */
  topItems?: EraOpsNavItem[];
  resolveActive?: (pathname: string, href: string) => boolean;
}) {
  const pathname = usePathname() ?? "";
  const activeFn =
    resolveActive ??
    ((p: string, href: string) => {
      if (href === "/") return p === "/";
      return p === href || p.startsWith(`${href}/`);
    });

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto py-1">
      {topItems.map((item) => (
        <NavLink key={item.id ?? item.href ?? item.label} item={item} />
      ))}
      {sections
        .filter((section) => !section.hidden)
        .map((section) => (
          <CollapsibleSection
            key={section.id}
            section={section}
            pathname={pathname}
            resolveActive={activeFn}
          />
        ))}
    </div>
  );
}
