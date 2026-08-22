'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader, showApiError } from '@era/satellite-kit/ui';

type Row = {
  id: string;
  roomNumber: string;
  inventoryStatus: string;
  inventoryReason: string | null;
  closures?: { startDate: string; endDate: string | null; reason: string | null }[];
};

export default function ClosedRoomsPage() {
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/housekeeping/closed-rooms');
    const json = await res.json();
    if (!res.ok) {
      showApiError(json, tc('loadError'));
      return;
    }
    setRows(Array.isArray(json) ? json : []);
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const ooo = rows.filter((r) => r.inventoryStatus === 'OOO');
  const oos = rows.filter((r) => r.inventoryStatus === 'OOS');

  function lane(title: string, list: Row[]) {
    return (
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">{title}</h2>
        <ul className="space-y-1 text-sm">
          {list.map((r) => {
            const c = r.closures?.[0];
            return (
              <li key={r.id}>
                {r.roomNumber} {c ? `· ${String(c.startDate).slice(0, 10)}–${c.endDate ? String(c.endDate).slice(0, 10) : '…'}` : ''}{' '}
                {r.inventoryReason ?? c?.reason ?? ''}
              </li>
            );
          })}
          {list.length === 0 ? <li className="text-[#7F8C8D]">{tc('dash')}</li> : null}
        </ul>
      </section>
    );
  }

  return (
    <>
      <PageHeader title={t('closedRoomsTitle')} />
      {lane(t('oooLane'), ooo)}
      {lane(t('oosLane'), oos)}
    </>
  );
}
