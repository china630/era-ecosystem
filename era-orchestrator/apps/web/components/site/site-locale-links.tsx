"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ERA_I18N_COOKIE, type Locale } from "@era/i18n-common";
import { SITE_LOCALES, stripLocalePrefix, swapLocaleInPath } from "../../lib/site/locale-path";

function setLocaleCookie(loc: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `${ERA_I18N_COOKIE}=${loc}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function SiteLocaleLinks({ locale }: { locale: Locale }) {
  const pathname = usePathname() ?? `/${locale}`;
  const bare = stripLocalePrefix(pathname);
  const onUnprefixedCalc = bare === "/calc" || bare.startsWith("/calc/");

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-[#D5DADF] bg-white p-0.5 text-[11px] font-semibold">
      {SITE_LOCALES.map((loc) => {
        const href = onUnprefixedCalc ? "/calc" : swapLocaleInPath(pathname, loc);
        const active = loc === locale;
        return (
          <Link
            key={loc}
            href={href}
            hrefLang={loc}
            className={`rounded-md px-2 py-1 no-underline ${
              active ? "bg-[#EBF5FB] text-[#2471A3]" : "text-[#7F8C8D] hover:text-[#34495E]"
            }`}
            onClick={(e) => {
              setLocaleCookie(loc);
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
        );
      })}
    </div>
  );
}
