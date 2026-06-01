"use client";

import Link from "next/link";
import type { EraOpsTopBarProps } from "./era-ops-types";
import { GHOST_BUTTON_CLASS } from "./design-system";

export function EraOpsTopBar({ title, quickLinks, actions }: EraOpsTopBarProps) {
  if (!title && !quickLinks?.length && !actions) return null;

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#D5DADF] bg-white px-4 py-2">
      {title ? (
        <h1 className="mr-auto text-[13px] font-semibold text-[#34495E]">{title}</h1>
      ) : (
        <div className="mr-auto" />
      )}
      {quickLinks?.length ? (
        <div className="flex flex-wrap items-center gap-1">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            const className = `${GHOST_BUTTON_CLASS} gap-1.5 px-2.5`;
            const content = (
              <>
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{link.label}</span>
              </>
            );
            if (link.onClick) {
              return (
                <button
                  key={link.label}
                  type="button"
                  onClick={link.onClick}
                  className={className}
                  title={link.label}
                >
                  {content}
                </button>
              );
            }
            if (link.external && link.href) {
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={className}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.label}
                >
                  {content}
                </a>
              );
            }
            if (!link.href) return null;
            return (
              <Link key={link.href} href={link.href} className={className} title={link.label}>
                {content}
              </Link>
            );
          })}
        </div>
      ) : null}
      {actions}
    </header>
  );
}
