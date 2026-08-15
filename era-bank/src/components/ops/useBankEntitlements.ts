"use client";

import { useEffect, useState } from "react";
import { isNavAllowedForRole } from "@/components/ops/bank-role-nav";
import { useOpsMe } from "@/components/ops/useOpsMe";

const NAV_MODULE_MAP: Record<string, string> = {
  "/cif": "banking_core",
  "/accounts": "banking_core",
  "/postings": "banking_core",
  "/gl": "banking_core",
  "/admin/branches": "banking_core",
  "/admin/eod": "banking_core",
  "/admin/audit": "banking_core",
  "/aml": "banking_aml",
  "/deposits": "banking_deposits",
  "/loans": "banking_loans",
  "/payments": "banking_payments",
  "/cash": "banking_cash",
  "/fees": "banking_core",
  "/collections": "banking_collections",
  "/trade": "banking_trade",
  "/islamic": "banking_islamic",
  "/wealth": "banking_wealth",
  "/reports": "banking_regreporting",
  "/cards": "banking_cards",
  "/cards/atm": "banking_cards",
  "/card-txns": "banking_cards",
  "/markets": "banking_markets",
  "/treasury": "banking_treasury",
  "/risk": "banking_risk",
  "/admin/product-factory": "banking_core",
  "/dashboard": "industry_banking",
};

export function useBankEntitlements() {
  const me = useOpsMe();
  const [modules, setModules] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/entitlements", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { modules: [] }))
      .then((d: { modules?: string[] }) => setModules(d.modules ?? []))
      .catch(() => setModules([]));
  }, []);

  function isModuleVisible(href: string): boolean {
    if (!modules) return true;
    // Demo/docker often has only the satellite gate — do not hide module screens.
    if (modules.includes("industry_banking") && modules.length === 1) return true;
    const prefix = Object.keys(NAV_MODULE_MAP).find((p) => href.startsWith(p));
    if (!prefix) return true;
    const mod = NAV_MODULE_MAP[prefix];
    return modules.includes(mod) || modules.includes("industry_banking");
  }

  function isNavVisible(href: string): boolean {
    if (!isModuleVisible(href)) return false;
    if (me?.isPlatformSuperAdmin) return true;
    return isNavAllowedForRole(href, me?.role);
  }

  return { modules, role: me?.role ?? null, isNavVisible };
}
