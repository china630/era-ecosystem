"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type CardDetail = {
  id: string;
  panLast4?: string;
  bin6?: string;
  status?: string;
  expiryMonth?: number;
  expiryYear?: number;
};

export default function DboCardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("cards");
  const tc = useTranslations("common");
  const [card, setCard] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    fetch(`/api/cards/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setCard(data.card ?? data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : tc("error")))
      .finally(() => setLoading(false));
  }, [id, tc]);

  async function temporaryBlock() {
    setBlocking(true);
    setError(null);
    try {
      const res = await fetch(`/api/cards/${id}/temporary-block`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCard(data.card ?? data);
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("error"));
    } finally {
      setBlocking(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link href="/cards" className="text-sm text-dbo-primary">
        ← {t("back")}
      </Link>
      {loading ? <p className="text-sm text-dbo-muted">{tc("loading")}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {card ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-mono text-lg">
            {card.bin6 ?? "******"} ··· {card.panLast4 ?? "****"}
          </p>
          <p className="mt-2 text-sm text-dbo-muted">
            {t("status")}: {card.status}
          </p>
          {card.status === "ACTIVE" ? (
            <button
              type="button"
              disabled={blocking}
              onClick={temporaryBlock}
              className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {blocking ? tc("loading") : t("temporaryBlock")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
