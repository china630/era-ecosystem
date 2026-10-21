"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type EraMenuProps = {
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "left" | "right";
  panelClassName?: string;
  className?: string;
};

/**
 * Dismissable menu: outside click, Escape, and a data-era-menu-item click close it.
 */
export function EraMenu({
  trigger,
  children,
  open: openProp,
  onOpenChange,
  align = "right",
  panelClassName = "",
  className = "",
}: EraMenuProps) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = openProp ?? uncontrolled;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openProp === undefined) setUncontrolled(next);
  };
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`relative inline-flex ${className}`} ref={ref}>
      <div
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          }
        }}
      >
        {trigger}
      </div>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={`${align === "right" ? "right-0" : "left-0"} absolute top-full z-50 mt-1 min-w-[180px] rounded-lg border border-[#D5DADF] bg-white py-1 shadow-lg ${panelClassName}`}
          onClick={(e) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest("[data-era-menu-item]")) setOpen(false);
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function EraMenuItem({
  children,
  onSelect,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-era-menu-item=""
      disabled={disabled}
      className={`block w-full px-3 py-2 text-left text-[13px] text-[#34495E] hover:bg-[#EBF5FB] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      onClick={() => {
        if (disabled) return;
        onSelect?.();
      }}
    >
      {children}
    </button>
  );
}
