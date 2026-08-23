'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Field, PageHeader, PRIMARY_BUTTON_CLASS, showApiError } from '@era/satellite-kit/ui';

export default function NewTourPage() {
  const t = useTranslations('tours');
  const router = useRouter();
  const [date, setDate] = useState('');
  const [pickupAt, setPickupAt] = useState('');
  const [returnAt, setReturnAt] = useState('');
  const [agenda, setAgenda] = useState('Goygol Sunday tour');
  const [meetingPoint, setMeetingPoint] = useState('Lobby');
  const [capacity, setCapacity] = useState('20');
  const [price, setPrice] = useState('80');

  async function save() {
    const res = await fetch('/api/tours/departures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        pickupAt: new Date(pickupAt).toISOString(),
        returnAt: new Date(returnAt).toISOString(),
        agenda,
        meetingPoint,
        capacity: Number(capacity),
        price: Number(price),
      }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    const row = await res.json();
    router.push(`/tours/${row.id}`);
  }

  return (
    <div className="max-w-xl space-y-3">
      <PageHeader title={t('newDeparture')} />
      <Field label={t('agenda')} preset="longText" value={agenda} onChange={(e) => setAgenda(e.target.value)} />
      <Field label="Date" preset="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <Field label={t('pickup')} preset="longText" type="datetime-local" value={pickupAt} onChange={(e) => setPickupAt(e.target.value)} />
      <Field label={t('return')} preset="longText" type="datetime-local" value={returnAt} onChange={(e) => setReturnAt(e.target.value)} />
      <Field label={t('meetingPoint')} preset="shortText" value={meetingPoint} onChange={(e) => setMeetingPoint(e.target.value)} />
      <Field label={t('capacity')} preset="code" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
      <Field label={t('price')} preset="amount" value={price} onChange={(e) => setPrice(e.target.value)} />
      <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void save()}>
        {t('save')}
      </button>
    </div>
  );
}
