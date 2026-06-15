"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Account = {
  id: string;
  iban?: string;
  balanceMinor?: number;
  currency?: string;
};

export default function AccountsPage() {
  const t = useTranslations("accounts");
  const tc = useTranslations("common");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/accounts")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setAccounts(Array.isArray(data.accounts) ? data.accounts : data.items ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : tc("error")))
      .finally(() => setLoading(false));
  }, [tc]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      {loading ? <p className="text-sm text-dbo-muted">{tc("loading")}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-3">
        {accounts.map((a) => (
          <li key={a.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-dbo-muted">{t("iban")}</p>
            <p className="font-mono text-sm">{a.iban ?? a.id}</p>
            <p className="mt-2 text-xs text-dbo-muted">{t("balance")}</p>
            <p className="text-xl font-semibold">
              {((a.balanceMinor ?? 0) / 100).toFixed(2)} {a.currency ?? "AZN"}
            </p>
            <Link href={`/accounts/${a.id}`} className="mt-3 inline-block text-sm text-dbo-primary">
              {t("viewDetails")}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
