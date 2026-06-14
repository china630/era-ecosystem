"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HeaderOrganization } from "@era/satellite-kit/ui";
import { useAuth } from "../lib/auth-context";

export function HeaderOrganizationSwitcher() {
  const { user, memberships, switchOrganization, ready, token } = useAuth();
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

  if (memberships.length <= 1) {
    return (
      <HeaderOrganization
        variant="label"
        organizationName={current?.organizationName ?? null}
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
          className="flex max-w-[240px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-left text-sm font-medium text-primary transition hover:border-action/40 hover:bg-action/10"
        >
          <span className="truncate">
            {current?.organizationName ?? user.organizationId ?? "—"}
          </span>
          <span className="shrink-0 text-gray-400" aria-hidden>
            ▾
          </span>
        </button>
        {open ? (
          <ul
            className="absolute right-0 z-50 mt-1 max-h-72 w-72 overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
            role="listbox"
          >
            {memberships.map((m) => (
              <li
                key={m.organizationId}
                role="option"
                aria-selected={m.organizationId === user.organizationId}
              >
                <button
                  type="button"
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-action/10"
                  onClick={() => {
                    if (m.organizationId === user.organizationId) {
                      pickDone();
                      return;
                    }
                    void switchOrganization(m.organizationId).then(pickDone);
                  }}
                >
                  <span className="truncate font-medium text-gray-900">
                    {m.organizationName ?? m.organizationId}
                  </span>
                </button>
              </li>
            ))}
            <li className="mt-1 border-t border-gray-100 pt-1">
              <Link
                href="/organizations"
                className="block px-3 py-2 text-sm text-action hover:bg-action/10"
                onClick={pickDone}
              >
                {t("organizations")}
              </Link>
            </li>
          </ul>
        ) : null}
      </div>
    </HeaderOrganization>
  );
}
