'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { hotelDateKey } from '@/lib/hotel-calendar';

type Offer = {
  ratePlanCode: string;
  ratePlanName?: string;
  name?: string;
  roomTypeCode?: string;
  amountPerNight: number;
  totalAmount?: number;
  available?: number;
};

export default function B2cBookingPage() {
  const t = useTranslations('channel');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState('');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('era_ibe_pk') : null;
    if (stored) setKey(stored);
  }, []);

  async function load() {
    setError(null);
    if (!key.trim()) {
      setError('Set IBE publishable key (from Channel Manager binding)');
      return;
    }
    localStorage.setItem('era_ibe_pk', key.trim());
    const from = hotelDateKey();
    const res = await fetch(
      `/api/public/v1/availability?from=${from}&nights=2&adults=2`,
      { headers: { Authorization: `Bearer ${key.trim()}` } },
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Availability failed');
      setOffers([]);
      return;
    }
    setOffers(
      (data.offers ?? []).map((o: Offer & { ratePlanName: string }) => ({
        ...o,
        name: o.ratePlanName ?? o.ratePlanCode,
      })),
    );
  }

  return (
    <main className="mx-auto max-w-lg p-4">
      <h1 className="mb-4 text-xl font-semibold">Direct booking (IBE)</h1>
      <label className="mb-3 block text-sm">
        IBE key
        <input
          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="pk_…"
        />
      </label>
      <button
        type="button"
        className="mb-4 rounded bg-[#2C3E50] px-3 py-1.5 text-sm text-white"
        onClick={() => void load()}
      >
        Search
      </button>
      {error ? <p className="mb-2 text-sm text-[#E74C3C]">{error}</p> : null}
      <ul className="space-y-2">
        {offers.map((o) => (
          <li key={`${o.roomTypeCode}-${o.ratePlanCode}`} className="rounded border p-3 text-sm">
            {o.roomTypeCode} · {o.name ?? o.ratePlanCode} — {o.amountPerNight} AZN / night
            {o.available != null ? ` · avail ${o.available}` : ''}
          </li>
        ))}
      </ul>
      {!offers.length && !error ? (
        <p className="text-sm text-[#7F8C8D]">{t('bindingHint')}</p>
      ) : null}
    </main>
  );
}
