"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, CreditCard, Home, LogOut, Send, ShieldCheck, Wallet } from "lucide-react";

type Props = {
  children: React.ReactNode;
  channel?: "RETAIL" | "CORPORATE";
};

const retailItems = [
  { href: "/dashboard", labelKey: "home" as const, icon: Home },
  { href: "/accounts", labelKey: "accounts" as const, icon: CreditCard },
  { href: "/cards", labelKey: "cards" as const, icon: Wallet },
  { href: "/payments", labelKey: "pay" as const, icon: Send },
  { href: "/transfers", labelKey: "transfers" as const, icon: Building2 },
];

const corporateExtra = { href: "/payments/approve", labelKey: "approve" as const, icon: ShieldCheck };

export default function DboShell({ children, channel = "RETAIL" }: Props) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const navItems =
    channel === "CORPORATE"
      ? [...retailItems.slice(0, 3), corporateExtra]
      : retailItems;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-dbo-surface">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-dbo-primary">ERA Bank</span>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1 text-xs text-dbo-muted hover:text-dbo-ink"
          >
            <LogOut className="h-4 w-4" />
            {t("logout")}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-10 mx-auto max-w-lg border-t border-slate-200 bg-white">
        <ul className="grid grid-cols-5 gap-1 px-2 py-2">
          {navItems.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] ${
                    active ? "bg-blue-50 text-dbo-primary" : "text-dbo-muted"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {t(labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
