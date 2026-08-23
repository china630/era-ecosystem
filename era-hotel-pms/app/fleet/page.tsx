'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';

type Vehicle = {
  id: string;
  code: string;
  brand: string;
  licensePlate: string;
  driverName: string | null;
  driverPhone: string | null;
  maxSeats: number;
  active: boolean;
};

export default function FleetPage() {
  const t = useTranslations('fleet');
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [brand, setBrand] = useState('');
  const [licensePlate, setPlate] = useState('');
  const [driverName, setDriver] = useState('');
  const [driverPhone, setPhone] = useState('');
  const [maxSeats, setSeats] = useState('18');

  const load = useCallback(async () => {
    const res = await fetch('/api/fleet/vehicles');
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    setRows(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    const res = await fetch('/api/fleet/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        brand,
        licensePlate,
        driverName,
        driverPhone,
        maxSeats: Number(maxSeats),
      }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    showSuccess('ok');
    setOpen(false);
    await load();
  }

  async function retire(id: string) {
    const res = await fetch(`/api/fleet/vehicles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setOpen(true)}>
        {t('add')}
      </button>
      <section className={CARD_CONTAINER_CLASS}>
        <ul className="divide-y divide-[#E8EEF2] text-[13px]">
          {rows.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span>
                {v.code} · {v.brand} · {v.licensePlate} · {v.maxSeats} {t('seats')} · {v.driverName}
              </span>
              <CatalogField
                kind="CLOSED_SMALL"
                label={t('active')}
                value={v.active ? 'true' : 'false'}
                onChange={() => undefined}
                options={[
                  { value: 'true', label: t('active') },
                  { value: 'false', label: t('retire') },
                ]}
              />
              {v.active ? (
                <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => void retire(v.id)}>
                  {t('retire')}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <EraModal open={open} title={t('add')} onClose={() => setOpen(false)}>
        <div className="space-y-2">
          <Field label={t('code')} preset="code" value={code} onChange={(e) => setCode(e.target.value)} />
          <Field label={t('brand')} preset="shortText" value={brand} onChange={(e) => setBrand(e.target.value)} />
          <Field label={t('plate')} preset="code" value={licensePlate} onChange={(e) => setPlate(e.target.value)} />
          <Field label={t('driver')} preset="shortText" value={driverName} onChange={(e) => setDriver(e.target.value)} />
          <Field label={t('phone')} preset="shortText" value={driverPhone} onChange={(e) => setPhone(e.target.value)} />
          <Field label={t('seats')} preset="code" value={maxSeats} onChange={(e) => setSeats(e.target.value)} />
        </div>
        <EraModalFooter onCancel={() => setOpen(false)} onSubmit={() => void create()} submitLabel={t('add')} />
      </EraModal>
    </div>
  );
}
