"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HeaderOrganization } from "@era/satellite-kit/ui";
import { useAuth } from "../lib/auth-context";

function modeBadge(mode: string | null | undefined): "ORG" | "DEPT" {
  return mode === "DEPARTMENT" ? "DEPT" : "ORG";
}

export function HeaderOrganizationSwitcher() {
  const { user, memberships, switchOrganization, setHomeOrganization, ready, token } =
    useAuth();
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const pickDone = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  if (!ready || !token || !user) return null;

  const current =
    memberships.find((m) => m.organizationId === user.organizationId) ?? null;
  const badge = modeBadge(current?.operatingMode);

  if (memberships.length <= 1) {
    return (
      <HeaderOrganization
        variant="label"
        organizationName={
          current
            ? `${current.organizationName ?? current.organizationId} · ${badge}`
            : null
        }
      />
    );
  }

  return (
    <HeaderOrganization variant="switcher">
      <div className="relative hidden sm:block" ref={wrapRef}>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={t("orgSwitcher")}
          onClick={() => setOpen((v) => !v)}
          className="flex max-w-[280px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-left text-sm font-medium text-primary transition hover:border-action/40 hover:bg-action/10"
        >
          <span className="truncate">
            {current?.organizationName ?? user.organizationId ?? "—"}
          </span>
          <span className="shrink-0 rounded bg-[#EBEDF0] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#5D6D7E]">
            {badge}
          </span>
          {current?.isHome ? (
            <span className="shrink-0 text-[12px] text-amber-600" title={t("homeOrg")}>
              ★
            </span>
          ) : null}
          <span className="shrink-0 text-gray-400" aria-hidden>
            ▾
          </span>
        </button>
        {open ? (
          <ul
            className="absolute right-0 z-50 mt-1 max-h-72 w-80 overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
            role="listbox"
          >
            {memberships.map((m) => {
              const rowBadge = modeBadge(m.operatingMode);
              const active = m.organizationId === user.organizationId;
              return (
                <li
                  key={m.organizationId}
                  role="option"
                  aria-selected={active}
                  className="flex items-stretch gap-1 px-1"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-action/10"
                    onClick={() => {
                      if (active) {
                        pickDone();
                        return;
                      }
                      void switchOrganization(m.organizationId).then(pickDone);
                    }}
                  >
                    <span className="flex items-center gap-1.5 truncate font-medium text-gray-900">
                      <span className="truncate">
                        {m.organizationName ?? m.organizationId}
                      </span>
                      <span className="shrink-0 rounded bg-[#EBEDF0] px-1 text-[10px] font-semibold uppercase text-[#5D6D7E]">
                        {rowBadge}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`shrink-0 px-2 text-[14px] ${
                      m.isHome ? "text-amber-600" : "text-gray-300 hover:text-amber-500"
                    }`}
                    title={t("setHomeOrg")}
                    aria-label={t("setHomeOrg")}
                    onClick={(e) => {
                      e.stopPropagation();
                      void setHomeOrganization(m.organizationId);
                    }}
                  >
                    ★
                  </button>
                </li>
              );
            })}
            <li className="mt-1 border-t border-gray-100 pt-1">
              <Link
                href="/organizations"
                className="block px-3 py-2 text-sm text-action hover:bg-action/10"
                onClick={pickDone}
              >
                {t("organizations")}
              </Link>
            </li>
            <li>
              <Link
                href="/workspace/structure"
                className="block px-3 py-2 text-sm text-action hover:bg-action/10"
                onClick={pickDone}
              >
                {t("structure")}
              </Link>
            </li>
          </ul>
        ) : null}
      </div>
    </HeaderOrganization>
  );
}
