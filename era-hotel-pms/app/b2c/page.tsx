'use client';

import { useEffect, useState } from 'react';

type Offer = { ratePlanCode: string; name: string; amountPerNight: number };

export default function B2cBookingPage() {
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    fetch('/api/public/booking/rates?nights=2')
      .then((r) => r.json())
      .then((d) => setOffers(d.offers ?? []));
  }, []);

  return (
    <main className="mx-auto max-w-lg p-4">
      <h1 className="mb-4 text-xl font-semibold">B2C booking (v2.0 MVP)</h1>
      <ul className="space-y-2">
        {offers.map((o) => (
          <li key={o.ratePlanCode} className="rounded border p-3 text-sm">
            {o.name} — {o.amountPerNight} AZN / night
          </li>
        ))}
      </ul>
    </main>
  );
}
