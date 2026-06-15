"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Account = {
  id: string;
  iban?: string;
  balanceMinor?: number;
  currency?: string;
};

export default function DashboardPage() {
  const t = useTranslations("dashboard");
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

  const totalMinor = accounts.reduce((sum, a) => sum + (a.balanceMinor ?? 0), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      {loading ? <p className="text-sm text-dbo-muted">{tc("loading")}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && !error ? (
        <>
          <section className="rounded-2xl bg-gradient-to-br from-dbo-primary to-blue-700 p-5 text-white">
            <p className="text-xs opacity-80">{t("totalBalance")}</p>
            <p className="mt-1 text-3xl font-bold">{(totalMinor / 100).toFixed(2)} AZN</p>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-medium text-dbo-muted">{t("recentActivity")}</h2>
            {accounts.length === 0 ? (
              <p className="text-sm text-dbo-muted">{t("noAccounts")}</p>
            ) : (
              <ul className="space-y-2">
                {accounts.slice(0, 5).map((a) => (
                  <li key={a.id} className="rounded-xl bg-white p-3 text-sm shadow-sm">
                    <div className="font-medium">{a.iban ?? a.id}</div>
                    <div className="text-dbo-muted">
                      {((a.balanceMinor ?? 0) / 100).toFixed(2)} {a.currency ?? "AZN"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
