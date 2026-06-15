"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type CardRow = {
  id: string;
  panLast4?: string;
  bin6?: string;
  status?: string;
  expiryMonth?: number;
  expiryYear?: number;
};

export default function DboCardsPage() {
  const t = useTranslations("cards");
  const tc = useTranslations("common");
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/cards")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setCards(Array.isArray(data) ? data : data.items ?? data.cards ?? []);
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
        {cards.map((c) => (
          <li key={c.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="font-mono text-sm">
              {c.bin6 ?? "******"} ··· {c.panLast4 ?? "****"}
            </p>
            <p className="mt-1 text-xs text-dbo-muted">
              {t("expiry")}: {String(c.expiryMonth ?? "").padStart(2, "0")}/{c.expiryYear ?? "—"}
            </p>
            <p className="mt-1 text-xs">
              {t("status")}: <span className="font-medium">{c.status ?? "—"}</span>
            </p>
            <Link href={`/cards/${c.id}`} className="mt-3 inline-block text-sm text-dbo-primary">
              {t("viewDetails")}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
