"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type EraMenuProps = {
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "left" | "right";
  panelClassName?: string;
  className?: string;
};

type MenuCoords = { top: number; left: number; minWidth: number };

/**
 * Dismissable menu: outside click, Escape, and a data-era-menu-item click close it.
 * Panel is portaled + fixed so overflow ancestors (folio grids) cannot clip it.
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
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [coords, setCoords] = useState<MenuCoords | null>(null);

  function updateCoords() {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 4;
    const panelH = panelRef.current?.offsetHeight ?? 200;
    const spaceBelow = window.innerHeight - r.bottom - gap;
    const spaceAbove = r.top - gap;
    const preferUp = spaceBelow < panelH && spaceAbove > spaceBelow;
    const top = preferUp ? Math.max(gap, r.top - panelH - gap) : r.bottom + gap;
    const minWidth = Math.max(180, r.width);
    let left = align === "right" ? r.right - minWidth : r.left;
    left = Math.min(Math.max(gap, left), window.innerWidth - minWidth - gap);
    setCoords({ top, left, minWidth });
  }

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updateCoords();
    const onReposition = () => updateCoords();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
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

  const panel =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="menu"
            className={`z-[400] min-w-[180px] rounded-lg border border-[#D5DADF] bg-white py-1 shadow-lg ${panelClassName}`}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              minWidth: coords.minWidth,
            }}
            onClick={(e) => {
              const target = e.target as HTMLElement | null;
              if (target?.closest("[data-era-menu-item]")) setOpen(false);
            }}
          >
            {children}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={`relative inline-flex ${className}`} ref={rootRef}>
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
      {panel}
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
