'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraDataGrid, PageHeader } from '@era/satellite-kit/ui';
import AppShell from '@/components/layout/AppShell';

type Row = {
  staffName: string;
  serviceName: string;
  count: number;
};

export default function SpaStaffMatchPage() {
  const t = useTranslations('serviceStaffMatch');
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/procedures/appointments');
    const data = await res.json();
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <PageHeader title={t('title')} />
      <EraDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'staffName', header: t('staff') },
          { key: 'serviceName', header: t('service') },
          { key: 'count', header: t('appointments') },
        ]}
        rows={rows}
        rowKey={(r) => `${r.staffName}-${r.serviceName}`}
      />
    </AppShell>
  );
}
