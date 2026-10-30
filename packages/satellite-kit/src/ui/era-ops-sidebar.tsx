"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { EraOpsNavItem, EraOpsSidebarProps } from "./era-ops-types";
import { SIDEBAR_LINK_ACTIVE_CLASS, SIDEBAR_LINK_CLASS } from "./design-system";
import { isRailFlyoutTarget, RailFlyout } from "./rail-flyout";
import { bestMatchingNavHref, collectNavHrefs, isBestNavHref } from "./nav-href-match";

function NavItemGroup({
  item,
  kids,
  collapsed,
  linkActive,
}: {
  item: EraOpsNavItem;
  kids: EraOpsNavItem[];
  collapsed: boolean;
  linkActive: (item: EraOpsNavItem) => boolean;
}) {
  const Icon = item.icon;
  const pathname = usePathname();
  const [flyout, setFlyout] = useState(false);
  const childOnRoute = kids.some((child) => linkActive(child));
  const [open, setOpen] = useState(childOnRoute);
  const rootRef = useRef<HTMLDivElement>(null);
  const userClosedRef = useRef(false);

  useEffect(() => {
    setFlyout(false);
    if (childOnRoute) {
      if (!userClosedRef.current) setOpen(true);
    } else {
      setOpen(false);
      userClosedRef.current = false;
    }
  }, [pathname, childOnRoute]);

  useEffect(() => {
    if (!flyout) return;
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      if (isRailFlyoutTarget(event.target)) return;
      setFlyout(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [flyout]);

  const links = kids.map((child) => {
    const ChildIcon = child.icon;
    const childClass = linkActive(child) ? SIDEBAR_LINK_ACTIVE_CLASS : SIDEBAR_LINK_CLASS;
    return (
      <Link key={child.id ?? child.href} href={child.href!} className={childClass}>
        {ChildIcon ? <ChildIcon className="h-4 w-4 shrink-0" aria-hidden /> : null}
        <span className="truncate">{child.label}</span>
      </Link>
    );
  });

  return (
    <div className="relative mt-2" ref={rootRef}>
      <button
        type="button"
        className={`hidden w-full items-center justify-center rounded-lg px-2 py-2 text-[#7F8C8D] hover:bg-[#F8F9FA] lg:flex ${collapsed ? "" : "lg:hidden"}`}
        title={item.label}
        aria-label={item.label}
        aria-expanded={flyout}
        onClick={() => setFlyout((v) => !v)}
      >
        {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
      </button>
      {flyout && collapsed ? (
        <RailFlyout open anchorRef={rootRef}>
          <p className="px-3 py-1 text-[13px] font-semibold text-[#7F8C8D]">
            {item.label}
          </p>
          {links}
        </RailFlyout>
      ) : null}
      <div className={collapsed ? "lg:hidden" : ""}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen((v) => {
              const next = !v;
              userClosedRef.current = !next && childOnRoute;
              return next;
            });
          }}
          className="flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-left text-[13px] font-semibold text-[#7F8C8D] transition hover:border-[#D5DADF] hover:bg-[#F8F9FA]"
        >
          {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <span className="shrink-0 text-[#BDC3C7]" aria-hidden>
            {open ? "▾" : "▸"}
          </span>
        </button>
        {open
          ? kids.map((child) => {
              const ChildIcon = child.icon;
              const childClass = linkActive(child)
                ? SIDEBAR_LINK_ACTIVE_CLASS
                : SIDEBAR_LINK_CLASS;
              return (
                <Link
                  key={child.id ?? child.href}
                  href={child.href!}
                  className={`${childClass} pl-8`}
                >
                  {ChildIcon ? (
                    <ChildIcon className="h-4 w-4 shrink-0" aria-hidden />
                  ) : null}
                  <span className="truncate">{child.label}</span>
                </Link>
              );
            })
          : null}
      </div>
    </div>
  );
}

export function EraOpsSidebarNav({
  items,
  collapsed = false,
}: {
  items: EraOpsNavItem[];
  collapsed?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const search = useSearchParams();
  const bestHref = bestMatchingNavHref(pathname, search, collectNavHrefs(items));
  const linkActive = (item: EraOpsNavItem) =>
    item.href ? isBestNavHref(item.href, bestHref) : Boolean(item.active);
  return (
    <nav className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto p-3">
      {items
        .filter((item) => !item.hidden)
        .map((item) => {
          const Icon = item.icon;
          const className = [
            linkActive(item) ? SIDEBAR_LINK_ACTIVE_CLASS : SIDEBAR_LINK_CLASS,
            collapsed ? "lg:justify-center lg:px-2" : "",
          ].join(" ");
          const content = (
            <>
              {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
              <span className={collapsed ? "truncate lg:sr-only" : "truncate"}>{item.label}</span>
            </>
          );
          if (item.onClick) {
            return (
              <button
                key={item.id ?? item.href ?? item.label}
                type="button"
                title={collapsed ? item.label : undefined}
                onClick={item.onClick}
                className={`${className} w-full`}
              >
                {content}
              </button>
            );
          }
          if (item.external && item.href) {
            return (
              <a
                key={item.id ?? item.href}
                href={item.href}
                className={className}
                title={collapsed ? item.label : undefined}
                target="_blank"
                rel="noopener noreferrer"
              >
                {content}
              </a>
            );
          }
          const kids = (item.children ?? []).filter((child) => !child.hidden && child.href);
          if (kids.length > 0) {
            return (
              <NavItemGroup
                key={item.id ?? item.label}
                item={item}
                kids={kids}
                collapsed={collapsed}
                linkActive={linkActive}
              />
            );
          }
          if (!item.href) return null;
          return (
            <Link key={item.id ?? item.href} href={item.href} className={className} title={collapsed ? item.label : undefined}>
              {content}
            </Link>
          );
        })}
    </nav>
  );
}

export function EraOpsSidebar({
  title,
  children,
  footer,
  widthClass = "w-56",
}: EraOpsSidebarProps) {
  return (
    <aside
      className={`flex ${widthClass} min-w-0 shrink-0 flex-col overflow-x-hidden border-r border-[#D5DADF] bg-white`}
    >
      <div className="border-b border-[#D5DADF] px-4 py-4">
        <p className="text-[13px] font-semibold text-[#34495E]">{title}</p>
      </div>
      {children}
      {footer ? (
        <div className="space-y-2 border-t border-[#D5DADF] p-3">{footer}</div>
      ) : null}
    </aside>
  );
}
