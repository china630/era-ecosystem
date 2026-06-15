"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type AccountDetail = {
  id: string;
  iban?: string;
  balanceMinor?: number;
  currency?: string;
  productName?: string;
};

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("accounts");
  const tc = useTranslations("common");
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/accounts/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setAccount(data.account ?? data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : tc("error")))
      .finally(() => setLoading(false));
  }, [id, tc]);

  return (
    <div className="space-y-4">
      <Link href="/accounts" className="text-sm text-dbo-primary">
        ← {tc("back")}
      </Link>
      <h1 className="text-lg font-semibold">{account?.productName ?? t("title")}</h1>
      {loading ? <p className="text-sm text-dbo-muted">{tc("loading")}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {account ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-dbo-muted">{t("iban")}</p>
          <p className="font-mono text-sm">{account.iban ?? account.id}</p>
          <p className="mt-3 text-xs text-dbo-muted">{t("balance")}</p>
          <p className="text-2xl font-semibold">
            {((account.balanceMinor ?? 0) / 100).toFixed(2)} {account.currency ?? "AZN"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
