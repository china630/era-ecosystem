'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';

type Departure = {
  id: string;
  date: string;
  pickupAt: string;
  returnAt: string;
  agenda: string;
  capacity: number;
  status: string;
  price: number;
  _count?: { bookings: number };
};

const STATUS_OPTS = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'DRAFT' },
  { value: 'OPEN', label: 'OPEN' },
  { value: 'CLOSED', label: 'CLOSED' },
  { value: 'DEPARTED', label: 'DEPARTED' },
  { value: 'CANCELLED', label: 'CANCELLED' },
];

export default function ToursPage() {
  const t = useTranslations('tours');
  const [rows, setRows] = useState<Departure[]>([]);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`/api/tours/departures${q}`);
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    setRows(await res.json());
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <CatalogField
        kind="CLOSED_SMALL"
        label={t('status')}
        value={status}
        onChange={(v) => setStatus(String(v))}
        options={STATUS_OPTS}
      />
      <section className={CARD_CONTAINER_CLASS}>
        <ul className="divide-y divide-[#E8EEF2]">
          {rows.map((d) => (
            <li key={d.id} className="px-3 py-2">
              <Link href={`/tours/${d.id}`} className="text-[#2980B9]">
                {d.date.slice(0, 10)} · {d.agenda || '—'} · {d.status} ·{' '}
                {d._count?.bookings ?? 0}/{d.capacity}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <Link href="/tours/new" className={PRIMARY_BUTTON_CLASS}>
        {t('newDeparture')}
      </Link>
    </div>
  );
}
