"use client";

import { useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * Collapsed-rail menu. The sidebar clips overflow, so the menu is painted on the page
 * next to the icon and shifted up when it would leave the viewport.
 */
export function RailFlyout({
  open,
  anchorRef,
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const [box, setBox] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setBox(null);
      return;
    }
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margin = 8;
      const width = 220;
      let left = rect.right + 4;
      if (left + width > window.innerWidth - margin) {
        left = Math.max(margin, rect.left - width - 4);
      }
      let top = rect.top;
      const roomBelow = window.innerHeight - margin - top;
      if (roomBelow < 160) {
        top = Math.max(margin, window.innerHeight - margin - 320);
      }
      setBox({
        top,
        left,
        maxHeight: Math.max(120, window.innerHeight - top - margin),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef]);

  if (!open || !box || typeof document === "undefined") return null;
  return createPortal(
    <div
      data-rail-flyout=""
      className="flex min-w-[13rem] flex-col gap-0.5 overflow-y-auto rounded-lg border border-[#D5DADF] bg-white p-2 shadow-lg"
      style={{
        position: "fixed",
        top: box.top,
        left: box.left,
        maxHeight: box.maxHeight,
        zIndex: 80,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function isRailFlyoutTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("[data-rail-flyout]"));
}
