"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { EraOpsNavItem, EraOpsNavSection } from "./era-ops-types";
import { SIDEBAR_LINK_ACTIVE_CLASS, SIDEBAR_LINK_CLASS } from "./design-system";
import { isRailFlyoutTarget, RailFlyout } from "./rail-flyout";
import {
  bestMatchingNavHref,
  collectSectionHrefs,
  isBestNavHref,
  navHrefMatches,
  sectionContainsPath,
  type NavSearch,
} from "./nav-href-match";

function branchContains(
  item: EraOpsNavItem,
  pathname: string,
  search: NavSearch,
): boolean {
  if (item.href && navHrefMatches(pathname, search, item.href)) return true;
  return item.children?.some((child) => branchContains(child, pathname, search)) ?? false;
}

type RailMode = {
  /** Desktop icon rail. Flyout children keep their labels. */
  collapsed: boolean;
  flyoutId: string | null;
  setFlyoutId: (id: string | null) => void;
};

const RailModeContext = createContext<RailMode>({
  collapsed: false,
  flyoutId: null,
  setFlyoutId: () => undefined,
});

function NavLink({ item }: { item: EraOpsNavItem }) {
  const { collapsed } = useContext(RailModeContext);
  const iconOnly = collapsed;
  const Icon = item.icon;
  const className = [
    item.active ? SIDEBAR_LINK_ACTIVE_CLASS : SIDEBAR_LINK_CLASS,
    iconOnly ? "lg:justify-center lg:gap-0 lg:px-2" : "",
  ].join(" ");
  const content = (
    <>
      {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
      <span className={iconOnly ? "truncate lg:sr-only" : "truncate"}>{item.label}</span>
    </>
  );

  if (item.onClick) {
    return (
      <button type="button" title={iconOnly ? item.label : undefined} onClick={item.onClick} className={`${className} w-full`}>
        {content}
      </button>
    );
  }

  if (item.external && item.href) {
    return (
      <a
        href={item.href}
        className={className}
        title={iconOnly ? item.label : undefined}
        target="_blank"
        rel="noopener noreferrer"
      >
        {content}
      </a>
    );
  }

  if (!item.href) return null;

  return (
    <Link href={item.href} className={className} title={iconOnly ? item.label : undefined}>
      {content}
    </Link>
  );
}

function NavBranch({
  item,
  bestHref,
  open,
  onToggle,
}: {
  item: EraOpsNavItem;
  bestHref: string | null;
  /** When set, sibling branches are accordion-controlled by the parent section. */
  open?: boolean;
  onToggle?: () => void;
}) {
  const { collapsed } = useContext(RailModeContext);
  const kids = (item.children ?? []).filter((child) => !child.hidden);
  if (kids.length === 0) {
    const active = item.href ? isBestNavHref(item.href, bestHref) : Boolean(item.active);
    return <NavLink item={{ ...item, active }} />;
  }

  const active = item.href ? isBestNavHref(item.href, bestHref) : false;
  const Icon = item.icon;
  const expanded = open ?? false;

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        title={collapsed ? item.label : undefined}
        className={`${active ? SIDEBAR_LINK_ACTIVE_CLASS : SIDEBAR_LINK_CLASS} w-full text-left ${collapsed ? "lg:justify-center lg:px-2" : ""}`}
      >
        {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
        <span className={collapsed ? "flex-1 truncate lg:sr-only" : "flex-1 truncate"}>{item.label}</span>
        {expanded ? (
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 ${collapsed ? "lg:hidden" : ""}`} aria-hidden />
        ) : (
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${collapsed ? "lg:hidden" : ""}`} aria-hidden />
        )}
      </button>
      {expanded ? (
        <div className="ml-3 flex flex-col gap-0.5 border-l border-[#ECF0F1] pl-2">
          {kids.map((child) => {
            const childActive = child.href
              ? isBestNavHref(child.href, bestHref)
              : Boolean(child.active);
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
  search,
  bestHref,
  open,
  onToggle,
}: {
  section: EraOpsNavSection;
  pathname: string;
  search: NavSearch;
  bestHref: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  const visibleItems = section.items.filter((item) => !item.hidden);
  const routeBranch = visibleItems.find(
    (item) =>
      (item.children ?? []).some((child) => !child.hidden) &&
      branchContains(item, pathname, search),
  );
  const routeBranchKey = routeBranch ? (routeBranch.id ?? routeBranch.label) : null;
  const [openBranch, setOpenBranch] = useState<string | null>(routeBranchKey);
  useEffect(() => {
    setOpenBranch(routeBranchKey);
  }, [pathname, routeBranchKey]);
  const rail = useContext(RailModeContext);
  const rootRef = useRef<HTMLDivElement>(null);
  const setFlyoutId = rail.setFlyoutId;
  const flyoutOpen = rail.collapsed && rail.flyoutId === section.id;

  useEffect(() => {
    if (!flyoutOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      if (isRailFlyoutTarget(event.target)) return;
      setFlyoutId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [flyoutOpen, setFlyoutId]);

  if (visibleItems.length === 0) return null;

  if (section.flat && visibleItems.length === 1) {
    const item = visibleItems[0]!;
    const active = item.href ? isBestNavHref(item.href, bestHref) : Boolean(item.active);
    return <NavLink item={{ ...item, active }} />;
  }

  const Icon = section.icon;

  const branches = visibleItems.map((item) => {
    const branchKey = item.id ?? item.label;
    const nested = (item.children ?? []).some((child) => !child.hidden);
    return (
      <NavBranch
        key={item.id ?? item.href ?? item.label}
        item={item}
        bestHref={bestHref}
        open={nested ? openBranch === branchKey : undefined}
        onToggle={
          nested
            ? () =>
                setOpenBranch((current) => (current === branchKey ? null : branchKey))
            : undefined
        }
      />
    );
  });

  return (
    <div className="relative flex flex-col gap-0" ref={rootRef}>
      <button
        type="button"
        aria-expanded={rail.collapsed ? flyoutOpen : open}
        aria-label={section.title}
        title={rail.collapsed ? section.title : undefined}
        onClick={() => {
          if (rail.collapsed) {
            rail.setFlyoutId(flyoutOpen ? null : section.id);
            return;
          }
          onToggle();
        }}
        className={`flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-left text-[#7F8C8D] transition hover:border-[#D5DADF] hover:bg-[#F8F9FA] ${rail.collapsed ? "lg:justify-center lg:px-2" : ""}`}
      >
        {Icon ? (
          <Icon className="h-4 w-4 shrink-0 text-[#7F8C8D]" aria-hidden />
        ) : null}
        <span className={rail.collapsed ? "flex-1 truncate text-[13px] font-semibold lg:sr-only" : "flex-1 truncate text-[13px] font-semibold"}>
          {section.title}
        </span>
        {open ? (
          <ChevronDown className={`h-4 w-4 shrink-0 text-[#BDC3C7] ${rail.collapsed ? "lg:hidden" : ""}`} aria-hidden />
        ) : (
          <ChevronRight className={`h-4 w-4 shrink-0 text-[#BDC3C7] ${rail.collapsed ? "lg:hidden" : ""}`} aria-hidden />
        )}
      </button>
      {flyoutOpen ? (
        <RailModeContext.Provider value={{ ...rail, collapsed: false }}>
          <RailFlyout open anchorRef={rootRef}>
            <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
              {section.title}
            </p>
            {branches}
          </RailFlyout>
        </RailModeContext.Provider>
      ) : null}
      {open && !rail.collapsed ? (
        <div className="ml-2 mt-1 flex flex-col gap-0.5 border-l-2 border-[#ECF0F1] pl-2">
          {branches}
        </div>
      ) : null}
    </div>
  );
}

function sectionOwnsPath(
  section: EraOpsNavSection,
  pathname: string,
  search: NavSearch,
): boolean {
  return sectionContainsPath(section, pathname, search);
}

export function EraOpsSidebarSections({
  sections,
  topItems = [],
  collapsed = false,
}: {
  sections: EraOpsNavSection[];
  /** Standalone links above collapsible sections (e.g. Finance-style Home / Əsas). */
  topItems?: EraOpsNavItem[];
  /** Desktop icon rail. Group click opens a flyout; labels stay on the flyout. */
  collapsed?: boolean;
  /** Ignored. Highlight is the single longest matching href, so a parent cannot stay lit. */
  resolveActive?: (pathname: string, href: string) => boolean;
}) {
  const pathname = usePathname() ?? "";
  const search = useSearchParams();
  const visibleSections = sections.filter((section) => !section.hidden);
  const hrefs = useMemo(
    () => collectSectionHrefs(visibleSections, topItems),
    [visibleSections, topItems],
  );
  const bestHref = bestMatchingNavHref(pathname, search, hrefs);
  const routeSectionId =
    visibleSections.find((section) => sectionOwnsPath(section, pathname, search))?.id ??
    null;
  const [openId, setOpenId] = useState<string | null>(routeSectionId);
  const [flyoutId, setFlyoutId] = useState<string | null>(null);
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setOpenId(routeSectionId);
    setFlyoutId(null);
  }, [pathname, routeSectionId]);

  const rail = useMemo<RailMode>(
    () => ({ collapsed: collapsed && desktop, flyoutId, setFlyoutId }),
    [collapsed, desktop, flyoutId],
  );

  return (
    <RailModeContext.Provider value={rail}>
    <div className="flex flex-1 flex-col gap-2 py-1">
      {topItems.map((item) => (
        <NavLink
          key={item.id ?? item.href ?? item.label}
          item={{
            ...item,
            active: item.href ? isBestNavHref(item.href, bestHref) : Boolean(item.active),
          }}
        />
      ))}
      {visibleSections.map((section) => (
        <CollapsibleSection
          key={section.id}
          section={section}
          pathname={pathname}
          search={search}
          bestHref={bestHref}
          open={openId === section.id}
          onToggle={() =>
            setOpenId((current) => (current === section.id ? null : section.id))
          }
        />
      ))}
    </div>
    </RailModeContext.Provider>
  );
}
