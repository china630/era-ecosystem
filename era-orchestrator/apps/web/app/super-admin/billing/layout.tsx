"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GHOST_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { BillingProvider } from "./billing-context";

const TABS = [
  { href: "/super-admin/billing/pricing", label: "Pricing" },
  { href: "/super-admin/billing/quotas", label: "Quotas" },
  { href: "/super-admin/billing/packages", label: "Packages" },
] as const;

export default function SuperAdminBillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <BillingProvider>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Billing configuration</h1>
          <Link href="/super-admin" className={GHOST_BUTTON_CLASS}>
            ← Hub
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const active =
              pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={[
                  "rounded-lg px-3 py-2 text-sm font-medium",
                  active
                    ? "bg-[#2980B9] text-white"
                    : "border border-[#D5DADF] text-[#34495E] hover:bg-[#F8F9FA]",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        {children}
      </div>
    </BillingProvider>
  );
}
