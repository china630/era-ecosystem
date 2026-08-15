'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  EraListFilterBar,
  useDebouncedValue,
  Field,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from "@/components/HotelDataGrid";

type Row = {
  staffName: string;
  serviceName: string;
  count: number;
};

export default function SpaStaffMatchPage() {
  const t = useTranslations('serviceStaffMatch');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/procedures/appointments');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      if (!Array.isArray(data)) return;
      const map = new Map<string, number>();
      for (const a of data) {
        const key = `${a.staffName ?? '—'}|${a.service?.name ?? '—'}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      setRows(
        [...map.entries()].map(([k, count]) => {
          const [staffName, serviceName] = k.split('|');
          return { staffName, serviceName, count };
        }),
      );
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.staffName} ${r.serviceName}`.toLowerCase().includes(q),
    );
  }, [rows, debouncedQ]);

  return (
    <>
      <PageHeader title={t('title')} />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => setQ('')}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </EraListFilterBar>
      <HotelDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'staffName', header: t('staff') },
          { key: 'serviceName', header: t('service') },
          { key: 'count', header: t('appointments') },
        ]}
        rows={filtered}
        rowKey={(r) => `${r.staffName}-${r.serviceName}`}
        emptyMessage={tc('empty')}
      />
    </>
  );
}
