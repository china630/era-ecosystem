"use client";

import { useEffect, useState } from "react";

const NAV_MODULE_MAP: Record<string, string> = {
  "/cif": "banking_core",
  "/accounts": "banking_core",
  "/postings": "banking_core",
  "/admin/branches": "banking_core",
  "/admin/eod": "banking_core",
  "/admin/audit": "banking_core",
  "/aml": "banking_aml",
  "/deposits": "banking_deposits",
  "/loans": "banking_loans",
  "/payments": "banking_payments",
  "/reports": "banking_regreporting",
  "/cards": "banking_cards",
  "/card-txns": "banking_cards",
  "/treasury": "banking_treasury",
  "/admin/product-factory": "banking_core",
  "/dashboard": "industry_banking",
};

export function useBankEntitlements() {
  const [modules, setModules] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/entitlements", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { modules: [] }))
      .then((d: { modules?: string[] }) => setModules(d.modules ?? []))
      .catch(() => setModules([]));
  }, []);

  function isNavVisible(href: string): boolean {
    if (!modules) return true;
    if (modules.includes("industry_banking") && modules.length === 1) return true;
    const prefix = Object.keys(NAV_MODULE_MAP).find((p) => href.startsWith(p));
    if (!prefix) return true;
    const mod = NAV_MODULE_MAP[prefix];
    return modules.includes(mod) || modules.includes("industry_banking");
  }

  return { modules, isNavVisible };
}
