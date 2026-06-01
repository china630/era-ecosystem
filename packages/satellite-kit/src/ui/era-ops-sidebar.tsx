"use client";

import Link from "next/link";
import type { EraOpsNavItem, EraOpsSidebarProps } from "./era-ops-types";
import { SIDEBAR_LINK_ACTIVE_CLASS, SIDEBAR_LINK_CLASS } from "./design-system";

export function EraOpsSidebarNav({ items }: { items: EraOpsNavItem[] }) {
  return (
    <nav className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto p-3">
      {items
        .filter((item) => !item.hidden)
        .map((item) => {
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
              <button
                key={item.id ?? item.href ?? item.label}
                type="button"
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
                target="_blank"
                rel="noopener noreferrer"
              >
                {content}
              </a>
            );
          }
          if (!item.href) return null;
          return (
            <Link key={item.id ?? item.href} href={item.href} className={className}>
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
