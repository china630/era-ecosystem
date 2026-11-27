"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { ERA_I18N_COOKIE, type Locale } from "@era/i18n-common";
import { SITE_LOCALES, stripLocalePrefix, swapLocaleInPath } from "../../lib/site/locale-path";

function setLocaleCookie(loc: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `${ERA_I18N_COOKIE}=${loc}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

/** Compact locale control: current code + dropdown (not three side-by-side chips). */
export function SiteLocaleLinks({ locale }: { locale: Locale }) {
  const pathname = usePathname() ?? `/${locale}`;
  const bare = stripLocalePrefix(pathname);
  const onUnprefixedCalc = bare === "/calc" || bare.startsWith("/calc/");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-lg border border-[#D5DADF] bg-white px-2 py-1.5 text-[12px] font-semibold text-[#34495E]"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        {locale.toUpperCase()}
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#7F8C8D] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute right-0 z-50 mt-1 min-w-[4.5rem] list-none rounded-xl border border-[#D5DADF] bg-white p-1 shadow-md"
        >
          {SITE_LOCALES.map((loc) => {
            const href = onUnprefixedCalc ? "/calc" : swapLocaleInPath(pathname, loc);
            const active = loc === locale;
            return (
              <li key={loc} role="option" aria-selected={active}>
                <Link
                  href={href}
                  hrefLang={loc}
                  className={`block rounded-lg px-2.5 py-1.5 text-[12px] font-semibold no-underline ${
                    active ? "bg-[#EBF5FB] text-[#2471A3]" : "text-[#34495E] hover:bg-[#EBEDF0]"
                  }`}
                  onClick={(e) => {
                    setLocaleCookie(loc);
                    setOpen(false);
                    if (onUnprefixedCalc && loc !== locale) {
                      e.preventDefault();
                      const q =
                        typeof window !== "undefined" ? window.location.search : "";
                      window.location.assign(`/calc${q}`);
                    }
                  }}
                >
                  {loc.toUpperCase()}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
