"use client";

import Link from "next/link";
import { User } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type HeaderProfileMenuItem = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export type HeaderProfileMenuProps = {
  displayName: string;
  email?: string;
  avatarUrl?: string | null;
  items?: HeaderProfileMenuItem[];
  onLogout: () => void;
  logoutLabel: string;
  menuAriaLabel?: string;
  /** Optional initials when no avatar (defaults from displayName). */
  initials?: string;
};

function buildInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function HeaderProfileMenu({
  displayName,
  email,
  avatarUrl,
  items = [],
  onLogout,
  logoutLabel,
  menuAriaLabel = "Account menu",
  initials,
}: HeaderProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const badge = initials ?? buildInitials(displayName);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={menuAriaLabel}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#D5DADF] bg-[#EBEDF0] text-[#34495E] transition hover:border-[#2980B9]/40 hover:bg-[#2980B9]/10"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[11px] font-bold leading-none">{badge}</span>
        )}
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-[70] mt-1 min-w-[12rem] rounded-xl border border-[#D5DADF] bg-white py-1 shadow-lg"
          role="menu"
        >
          <div className="border-b border-[#EBEDF0] px-3 py-2">
            <p className="truncate text-[13px] font-semibold text-[#34495E]">{displayName}</p>
            {email ? (
              <p className="truncate text-[11px] text-[#7F8C8D]">{email}</p>
            ) : null}
          </div>
          {items.map((item) => (
            <ProfileMenuRow key={item.label} item={item} onClose={() => setOpen(false)} />
          ))}
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#34495E] hover:bg-[#F4F5F7]"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <User className="h-4 w-4 shrink-0 text-[#7F8C8D]" aria-hidden />
            {logoutLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ProfileMenuRow({
  item,
  onClose,
}: {
  item: HeaderProfileMenuItem;
  onClose: () => void;
}) {
  const className =
    "block w-full px-3 py-2 text-left text-[13px] text-[#34495E] hover:bg-[#F4F5F7]";

  if (item.href) {
    return (
      <Link href={item.href} className={className} role="menuitem" onClick={onClose}>
        {item.label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      className={className}
      onClick={() => {
        onClose();
        item.onClick?.();
      }}
    >
      {item.label}
    </button>
  );
}
