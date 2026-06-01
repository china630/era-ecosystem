'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraDataGrid, PageHeader } from '@era/satellite-kit/ui';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  id: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  businessDay: { date: string };
  stepsJson: string | null;
  errorsJson: string | null;
};

export default function EndOfDayLogsPage() {
  const { can } = useAuth();
  const t = useTranslations('endOfDayLogs');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/reports/night-audit-runs?limit=100');
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? tc('loadError'));
      return;
    }
    setRows(Array.isArray(data) ? data : []);
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!can(PERMISSIONS.NIGHT_AUDIT_RUN)) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">{tc('accessDenied')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-[1400px]">
      <PageHeader title={t('title')} />
      <StatusMessage>{msg}</StatusMessage>
      <EraDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'date', header: t('businessDay'), render: (r) => r.businessDay.date.slice(0, 10) },
          { key: 'status', header: t('status') },
          { key: 'created', header: t('started'), render: (r) => r.createdAt.slice(0, 19) },
          {
            key: 'steps',
            header: t('steps'),
            render: (r) => {
              try {
                const steps = JSON.parse(r.stepsJson ?? '[]') as string[];
                return steps.length ? `${steps.length} steps` : '—';
              } catch {
                return '—';
              }
            },
          },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
      />
    </AppShell>
  );
}
