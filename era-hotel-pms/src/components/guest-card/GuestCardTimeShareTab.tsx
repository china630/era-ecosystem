'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraDataGrid } from '@era/satellite-kit/ui';

export type TimeShareFilter = 'ALL' | 'QUOTATION' | 'AGREEMENT' | 'CANCELLED';

export function GuestCardTimeShareTab({
  rows,
  guestId,
  onReload,
}: {
  rows: Array<{ id: string; contractNo: string; unitCode: string | null; weekNo: number | null; status: string }>;
  guestId: string | null;
  onReload: () => void;
}) {
  const t = useTranslations('guestCard');
  const [filter, setFilter] = useState<TimeShareFilter>('ALL');

  const filtered = useMemo(() => {
    if (filter === 'ALL') return rows;
    return rows.filter((r) => {
      const s = r.status.toUpperCase();
      if (filter === 'QUOTATION') return s.includes('QUOT');
      if (filter === 'AGREEMENT') return s === 'ACTIVE' || s.includes('AGREE');
      if (filter === 'CANCELLED') return s.includes('CANCEL');
      return true;
    });
  }, [rows, filter]);

  const tabs: { id: TimeShareFilter; label: string }[] = [
    { id: 'ALL', label: t('timeShare.tabAll') },
    { id: 'QUOTATION', label: t('timeShare.tabQuotation') },
    { id: 'AGREEMENT', label: t('timeShare.tabAgreement') },
    { id: 'CANCELLED', label: t('timeShare.tabCancel') },
  ];

  return (
    <div className="space-y-3 text-[13px]">
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`rounded px-2 py-1 text-[12px] ${filter === tab.id ? 'bg-[#2980B9] text-white' : 'bg-[#EBEDF0] text-[#34495E]'}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <EraDataGrid
        rows={filtered as Array<Record<string, unknown>>}
        columns={[
          { key: 'contractNo', header: t('timeShare.contract') },
          { key: 'unitCode', header: t('timeShare.unit') },
          { key: 'weekNo', header: t('timeShare.week') },
          { key: 'status', header: t('timeShare.status') },
        ]}
        rowKey={(r) => String(r.id)}
        emptyMessage={t('timeShare.empty')}
      />
      {guestId ? (
        <button
          type="button"
          className="text-[12px] font-medium text-[#2980B9]"
          onClick={async () => {
            const contractNo = window.prompt(t('timeShare.contract'));
            if (!contractNo) return;
            await fetch(`/api/guests/${guestId}/time-shares`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contractNo }),
            });
            onReload();
          }}
        >
          + {t('timeShare.add')}
        </button>
      ) : null}
    </div>
  );
}
