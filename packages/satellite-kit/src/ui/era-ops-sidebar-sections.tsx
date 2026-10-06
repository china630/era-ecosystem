"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { EraOpsNavItem, EraOpsNavSection } from "./era-ops-types";
import { SIDEBAR_LINK_ACTIVE_CLASS, SIDEBAR_LINK_CLASS } from "./design-system";

function branchActive(
  item: EraOpsNavItem,
  pathname: string,
  resolveActive: (pathname: string, href: string) => boolean,
): boolean {
  if (item.active) return true;
  if (item.href && resolveActive(pathname, item.href)) return true;
  return item.children?.some((child) => branchActive(child, pathname, resolveActive)) ?? false;
}

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

function NavBranch({
  item,
  pathname,
  resolveActive,
  open,
  onToggle,
}: {
  item: EraOpsNavItem;
  pathname: string;
  resolveActive: (pathname: string, href: string) => boolean;
  /** When set, sibling branches are accordion-controlled by the parent section. */
  open?: boolean;
  onToggle?: () => void;
}) {
  const kids = (item.children ?? []).filter((child) => !child.hidden);
  if (kids.length === 0) {
    const active = item.active ?? (item.href ? resolveActive(pathname, item.href) : false);
    return <NavLink item={{ ...item, active }} />;
  }

  const active = branchActive(item, pathname, resolveActive);
  const Icon = item.icon;
  const expanded = open ?? false;

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className={`${active ? SIDEBAR_LINK_ACTIVE_CLASS : SIDEBAR_LINK_CLASS} w-full text-left`}
      >
        {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
        <span className="flex-1 truncate">{item.label}</span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
      </button>
      {expanded ? (
        <div className="ml-3 flex flex-col gap-0.5 border-l border-[#ECF0F1] pl-2">
          {kids.map((child) => {
            const childActive =
              child.active ?? (child.href ? resolveActive(pathname, child.href) : false);
            return (
              <NavLink
                key={child.id ?? child.href ?? child.label}
                item={{ ...child, active: childActive }}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function CollapsibleSection({
  section,
  pathname,
  resolveActive,
  open,
  onToggle,
}: {
  section: EraOpsNavSection;
  pathname: string;
  resolveActive: (pathname: string, href: string) => boolean;
  open: boolean;
  onToggle: () => void;
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

  const sectionActive = visibleItems.some((item) =>
    branchActive(item, pathname, resolveActive),
  );
  const routeBranch = visibleItems.find(
    (item) =>
      (item.children ?? []).some((child) => !child.hidden) &&
      branchActive(item, pathname, resolveActive),
  );
  const routeBranchKey = routeBranch ? (routeBranch.id ?? routeBranch.label) : null;
  const [openBranch, setOpenBranch] = useState<string | null>(routeBranchKey);
  useEffect(() => {
    setOpenBranch(routeBranchKey);
  }, [pathname, routeBranchKey]);
  const Icon = section.icon;

  return (
    <div className="flex flex-col gap-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
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
          {visibleItems.map((item) => {
            const branchKey = item.id ?? item.label;
            const nested = (item.children ?? []).some((child) => !child.hidden);
            return (
              <NavBranch
                key={item.id ?? item.href ?? item.label}
                item={item}
                pathname={pathname}
                resolveActive={resolveActive}
                open={nested ? openBranch === branchKey : undefined}
                onToggle={
                  nested
                    ? () =>
                        setOpenBranch((current) =>
                          current === branchKey ? null : branchKey,
                        )
                    : undefined
                }
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function sectionOwnsPath(
  section: EraOpsNavSection,
  pathname: string,
  resolveActive: (pathname: string, href: string) => boolean,
): boolean {
  return section.items
    .filter((item) => !item.hidden)
    .some((item) => branchActive(item, pathname, resolveActive));
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
  const visibleSections = sections.filter((section) => !section.hidden);
  const routeSectionId =
    visibleSections.find((section) => sectionOwnsPath(section, pathname, activeFn))?.id ??
    null;
  const [openId, setOpenId] = useState<string | null>(routeSectionId);

  useEffect(() => {
    setOpenId(routeSectionId);
  }, [pathname, routeSectionId]);

  return (
    <div className="flex flex-1 flex-col gap-2 py-1">
      {topItems.map((item) => (
        <NavLink key={item.id ?? item.href ?? item.label} item={item} />
      ))}
      {visibleSections.map((section) => (
        <CollapsibleSection
          key={section.id}
          section={section}
          pathname={pathname}
          resolveActive={activeFn}
          open={openId === section.id}
          onToggle={() =>
            setOpenId((current) => (current === section.id ? null : section.id))
          }
        />
      ))}
    </div>
  );
}
