"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HeaderOrganization } from "@era/satellite-kit/ui";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api-client";

export function HeaderOrganizationSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { user, organizations, switchOrganization, ready, token } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tree, setTree] = useState<{
    holdings: Array<{
      holdingId: string;
      holdingName: string;
      baseCurrency: string;
      organizations: Array<{
        id: string;
        name: string;
        taxId: string;
        currency: string;
      }>;
    }>;
    freeOrganizations: Array<{
      id: string;
      name: string;
      taxId: string;
      currency: string;
    }>;
  } | null>(null);
  const [treeErr, setTreeErr] = useState<string | null>(null);

  const pickDone = useCallback(() => {
    setOpen(false);
    onNavigate?.();
  }, [onNavigate]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    setTreeErr(null);
    void apiFetch("/api/organizations/tree")
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setTreeErr(`${res.status}`);
          return;
        }
        setTree((await res.json()) as typeof tree);
      })
      .catch(() => setTreeErr("load"))
      .finally(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  if (!ready || !token || !user) return null;

  const current = organizations.find((o) => o.id === user.organizationId);

  if (organizations.length <= 1) {
    return (
      <HeaderOrganization variant="label" organizationName={current?.name ?? null} />
    );
  }

  return (
    <HeaderOrganization variant="switcher">
      <div className="relative hidden sm:block" ref={wrapRef}>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={t("orgSwitcher.aria")}
          onClick={() => setOpen((v) => !v)}
          className="flex max-w-[240px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-left text-sm font-medium text-primary transition hover:border-action/40 hover:bg-action/10"
        >
          <span className="truncate">{current?.name ?? "—"}</span>
          <span className="shrink-0 text-gray-400" aria-hidden>
            ▾
          </span>
        </button>
        {open ? (
          <ul
            className="absolute left-0 z-50 mt-1 max-h-72 w-72 overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
            role="listbox"
          >
            {treeErr ? (
              <li className="px-3 py-2 text-xs text-slate-500">
                {t("common.loadErr")}: {treeErr}
              </li>
            ) : null}

            {tree?.holdings?.length ? (
              <li className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t("orgSwitcher.holdingSection")}
              </li>
            ) : null}

            {(tree?.holdings ?? []).map((h) => (
              <li key={h.holdingId} className="pt-1">
                <Link
                  href={`/holding?id=${encodeURIComponent(h.holdingId)}`}
                  className="block px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-action/10"
                  onClick={pickDone}
                >
                  {h.holdingName}
                  <span className="ml-2 text-xs font-medium text-slate-500">
                    {h.baseCurrency}
                  </span>
                </Link>
                <ul className="pb-1">
                  {h.organizations.map((o) => (
                    <li key={o.id} role="option" aria-selected={o.id === user.organizationId}>
                      <button
                        type="button"
                        className="flex w-full flex-col gap-0.5 pl-6 pr-3 py-2 text-left text-sm hover:bg-action/10"
                        onClick={() => {
                          if (o.id === user.organizationId) {
                            pickDone();
                            return;
                          }
                          void switchOrganization(o.id)
                            .then(() => pickDone())
                            .catch(() => {
                              /* toast optional */
                            });
                        }}
                      >
                        <span className="truncate font-medium text-gray-900">{o.name}</span>
                        <span className="text-xs text-gray-500">VÖEN {o.taxId}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}

            {tree?.freeOrganizations?.length ? (
              <>
                <li className="mt-1 border-t border-gray-100" />
                <li className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {t("orgSwitcher.freeCompanies")}
                </li>
                {tree.freeOrganizations.map((o) => (
                  <li key={o.id} role="option" aria-selected={o.id === user.organizationId}>
                    <button
                      type="button"
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-action/10"
                      onClick={() => {
                        if (o.id === user.organizationId) {
                          pickDone();
                          return;
                        }
                        void switchOrganization(o.id)
                          .then(() => pickDone())
                          .catch(() => {
                            /* toast optional */
                          });
                      }}
                    >
                      <span className="truncate font-medium text-gray-900">{o.name}</span>
                      <span className="text-xs text-gray-500">VÖEN {o.taxId}</span>
                    </button>
                  </li>
                ))}
              </>
            ) : null}

            <li className="mt-1 border-t border-gray-100 pt-1">
              <Link
                href="/companies"
                className="block px-3 py-2 text-sm text-action hover:bg-action/10"
                onClick={pickDone}
              >
                {t("orgSwitcher.manageCompanies")}
              </Link>
            </li>
          </ul>
        ) : null}
      </div>
    </HeaderOrganization>
  );
}
