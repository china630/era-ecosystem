'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_SHELL_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DatePicker,
  EraListFilterBar,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import { hotelDateKey } from '@/lib/hotel-calendar';

interface OccupancyCell {
  date: string;
  total: number;
  sold: number;
  available: number;
}

interface OccupancyRow {
  roomTypeId: string;
  code: string;
  name: string;
  cells: OccupancyCell[];
  avgOccupancyPct: number;
}

interface OccupancyGrid {
  from: string;
  days: number;
  dates: string[];
  rows: OccupancyRow[];
}

function cellTone(free: number): string {
  if (free >= 3) return 'bg-[#E8F8F5]';
  if (free >= 0) return 'bg-[#FEF9E7]';
  return 'bg-[#FDEDEC]';
}

export default function OccupancyGridPage() {
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const [from, setFrom] = useState(() => hotelDateKey());
  const [days, setDays] = useState('14');
  const [grid, setGrid] = useState<OccupancyGrid | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ from, days });
    const res = await fetch(`/api/reports/occupancy?${qs}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      showApiError(body, tc('loadError'));
      setGrid(null);
      return;
    }
    setGrid(body);
  }, [days, from, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={t('occupancyTitle')} subtitle={t('occupancySubtitle')} />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setFrom(hotelDateKey());
          setDays('14');
        }}
      >
        <DatePicker
          label={t('dateFrom')}
          value={from}
          onChange={setFrom}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <CatalogField
          kind="OPS_HOT"
          label={t('horizon')}
          value={days}
          emptyLabel={null}
          options={[
            { value: '14', label: t('days14') },
            { value: '30', label: t('days30') },
          ]}
          onChange={(value) => setDays(Array.isArray(value) ? (value[0] ?? '14') : value || '14')}
        />
      </EraListFilterBar>
      <div className="mb-3 flex flex-wrap gap-4 text-[12px] text-[#34495E]">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-8 rounded border border-[#D5DADF] bg-[#E8F8F5]" />
          {t('legendFree')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-8 rounded border border-[#D5DADF] bg-[#FEF9E7]" />
          {t('legendTight')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-8 rounded border border-[#D5DADF] bg-[#FDEDEC]" />
          {t('legendOver')}
        </span>
      </div>
      <div className={DATA_TABLE_SHELL_CLASS}>
        <div className="overflow-x-auto">
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('type')}</th>
                {(grid?.dates ?? []).map((d) => (
                  <th key={d} className={DATA_TABLE_TH_LEFT_CLASS}>
                    {d.slice(5)}
                  </th>
                ))}
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('avgPct')}</th>
              </tr>
            </thead>
            <tbody>
              {(grid?.rows ?? []).map((row) => (
                <tr key={row.roomTypeId} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.code} · {row.name}
                  </td>
                  {row.cells.map((cell) => {
                    const free = cell.available - cell.sold;
                    return (
                      <td key={cell.date} className={`${DATA_TABLE_TD_CLASS} text-center ${cellTone(free)}`}>
                        {cell.sold}/{cell.total}
                      </td>
                    );
                  })}
                  <td className={DATA_TABLE_TD_CLASS}>{row.avgOccupancyPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
