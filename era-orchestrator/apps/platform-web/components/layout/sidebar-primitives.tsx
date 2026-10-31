"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, ChevronRight } from "lucide-react";

type SidebarLayout = {
  layoutCollapsed: boolean;
  openFlyoutKey: string | null;
  setOpenFlyoutKey: (k: string | null) => void;
};

const SidebarLayoutContext = createContext<SidebarLayout | null>(null);

function useSidebarLayout(): SidebarLayout {
  const v = useContext(SidebarLayoutContext);
  if (!v) throw new Error("useSidebarLayout: missing provider");
  return v;
}

export function CollapsibleNavSection({
  sectionKey,
  title,
  icon: Icon,
  sectionActive,
  children,
}: {
  sectionKey: string;
  title: string;
  icon: LucideIcon;
  sectionActive: boolean;
  children: ReactNode;
}) {
  const { layoutCollapsed, openFlyoutKey, setOpenFlyoutKey } = useSidebarLayout();
  const [open, setOpen] = useState(sectionActive);
  const rootRef = useRef<HTMLDivElement>(null);
  const flyoutOpen = openFlyoutKey === sectionKey;

  useEffect(() => {
    if (sectionActive) setOpen(true);
  }, [sectionActive]);

  useEffect(() => {
    if (!layoutCollapsed || !flyoutOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpenFlyoutKey(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [layoutCollapsed, flyoutOpen, setOpenFlyoutKey]);

  const expanded = layoutCollapsed ? flyoutOpen : open;

  return (
    <div className="relative flex flex-col gap-0" ref={rootRef}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={title}
        onClick={() => {
          if (layoutCollapsed) {
            setOpenFlyoutKey(flyoutOpen ? null : sectionKey);
          } else {
            setOpen((v) => !v);
          }
        }}
        className={[
          "flex w-full items-center gap-2 rounded-lg border px-3 py-2 transition",
          layoutCollapsed ? "lg:justify-center lg:px-2" : "",
          sectionActive
            ? "border-[#2980B9]/30 bg-[#EBF5FB] text-[#34495E] shadow-sm"
            : "border-transparent text-[#7F8C8D] hover:bg-[#E2E5E9]",
        ].join(" ")}
      >
        <Icon
          size={16}
          strokeWidth={2}
          className={[
            "shrink-0",
            sectionActive ? "text-[#2980B9]" : "text-[#7F8C8D]",
          ].join(" ")}
          aria-hidden
        />
        <span
          className={[
            "flex-1 truncate text-left text-sm font-semibold",
            layoutCollapsed ? "lg:sr-only" : "",
          ].join(" ")}
        >
          {title}
        </span>
        {layoutCollapsed ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 lg:hidden" aria-hidden />
        ) : expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
        )}
      </button>
      {layoutCollapsed && flyoutOpen ? (
        <div className="absolute left-full top-0 z-[60] ml-1 hidden min-w-[13rem] flex-col gap-0.5 rounded-lg border border-[#D5DADF] bg-white p-2 shadow-lg lg:flex">
          {children}
        </div>
      ) : null}
      {!layoutCollapsed && open ? (
        <div className="ml-2 mt-1 flex flex-col gap-0.5 border-l-2 border-gray-200 pl-4">
          {children}
        </div>
      ) : null}
      {layoutCollapsed ? (
        <div className="ml-2 mt-1 flex flex-col gap-0.5 border-l-2 border-gray-200 pl-4 lg:hidden">
          {open ? children : null}
        </div>
      ) : null}
    </div>
  );
}

export function SideNavItem({
  href,
  label,
  isActive,
  icon: Icon,
  nested = false,
  onNavClick,
}: {
  href: string;
  label: string;
  isActive: boolean;
  icon?: LucideIcon;
  nested?: boolean;
  onNavClick?: () => void;
}) {
  const { layoutCollapsed, setOpenFlyoutKey } = useSidebarLayout();

  return (
    <Link
      href={href}
      title={layoutCollapsed && !nested ? label : undefined}
      onClick={() => {
        if (layoutCollapsed) setOpenFlyoutKey(null);
        onNavClick?.();
      }}
      className={[
        "group flex items-center rounded-lg transition",
        nested ? "gap-2 px-2 py-1.5 text-sm" : "gap-3 px-3 py-2",
        layoutCollapsed && !nested ? "lg:justify-center lg:gap-0 lg:px-2" : "",
        isActive
          ? "bg-[#2980B9]/10 text-[#2980B9]"
          : "bg-transparent text-[#34495E] hover:bg-[#E2E5E9]",
      ].join(" ")}
    >
      {Icon ? (
        <Icon
          size={16}
          strokeWidth={2}
          className={[
            "shrink-0",
            isActive ? "text-[#2980B9]" : "text-[#7F8C8D]",
          ].join(" ")}
          aria-hidden
        />
      ) : (
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
      <span
        className={[
          "min-w-0 flex-1 truncate text-sm",
          isActive ? "font-semibold" : "font-medium",
          layoutCollapsed && !nested ? "lg:sr-only" : "",
        ].join(" ")}
      >
        {label}
      </span>
    </Link>
  );
}

export function SidebarLayoutProvider({
  layoutCollapsed,
  children,
}: {
  layoutCollapsed: boolean;
  children: ReactNode;
}) {
  const [openFlyoutKey, setOpenFlyoutKey] = useState<string | null>(null);
  return (
    <SidebarLayoutContext.Provider
      value={{ layoutCollapsed, openFlyoutKey, setOpenFlyoutKey }}
    >
      {children}
    </SidebarLayoutContext.Provider>
  );
}

export function SidebarLogo({
  title,
  subtitle,
  layoutCollapsed,
}: {
  title: string;
  subtitle: string;
  layoutCollapsed: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center gap-3",
        layoutCollapsed ? "lg:justify-center lg:gap-0" : "",
      ].join(" ")}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary bg-primary/10">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 7.5C4 6.11929 5.11929 5 6.5 5H20V19.5C20 20.8807 18.8807 22 17.5 22H6.5C5.11929 22 4 20.8807 4 19.5V7.5Z"
            stroke="#34495E"
            strokeWidth="1.5"
          />
          <path d="M7 9H17" stroke="#34495E" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M7 12H17" stroke="#34495E" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M7 15H13" stroke="#34495E" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className={["leading-tight", layoutCollapsed ? "lg:hidden" : ""].join(" ")}>
        <div className="text-[15px] font-semibold text-gray-900">{title}</div>
        <div className="text-[12px] text-gray-500">{subtitle}</div>
      </div>
    </div>
  );
}
