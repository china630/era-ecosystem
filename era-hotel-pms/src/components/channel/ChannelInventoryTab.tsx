'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  Field,
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import type { AvailabilityRow, StopSell } from './types';

export function ChannelInventoryTab({
  availFrom,
  availTo,
  onAvailFrom,
  onAvailTo,
  search,
  onSearch,
  availability,
  stopSells,
  onAddStopSell,
  onRemoveStopSell,
}: {
  availFrom: string;
  availTo: string;
  onAvailFrom: (v: string) => void;
  onAvailTo: (v: string) => void;
  search: string;
  onSearch: (v: string) => void;
  availability: AvailabilityRow[];
  stopSells: StopSell[];
  onAddStopSell: () => void;
  onRemoveStopSell: (id: string) => void;
}) {
  const t = useTranslations('channel');
  const tc = useTranslations('common');

  return (
    <div className="space-y-4">
      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('availabilityMatrix')}</h2>
        <div className="mb-3 flex flex-wrap gap-3">
          <DatePicker
            label={tc('from')}
            value={availFrom}
            onChange={onAvailFrom}
            placeholder={tc('datePlaceholder')}
            openCalendarLabel={tc('openCalendar')}
          />
          <DatePicker
            label={tc('to')}
            value={availTo}
            onChange={onAvailTo}
            placeholder={tc('datePlaceholder')}
            openCalendarLabel={tc('openCalendar')}
          />
        </div>
        <div className="overflow-x-auto text-[12px]">
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('roomType')}</th>
                {availability[0]?.days.map((d) => (
                  <th key={d.date} className={DATA_TABLE_TH_LEFT_CLASS}>
                    {d.date.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {availability.map((row) => (
                <tr key={row.roomTypeCode} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{row.roomTypeCode}</td>
                  {row.days.map((d) => (
                    <td
                      key={d.date}
                      className={`${DATA_TABLE_TD_CLASS} ${d.stopSell ? 'bg-rose-100' : ''}`}
                    >
                      {d.available}
                    </td>
                  ))}
                </tr>
              ))}
              {availability.length === 0 && (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={2} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {tc('dash')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('stopSell')}</h2>
            <p className="mt-1 text-[13px] text-[#7F8C8D]">{t('stopSellHint')}</p>
          </div>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={onAddStopSell}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('closeSales')}
          </button>
        </div>
        <div className="mb-3 max-w-sm">
          <Field
            label={tc('search')}
            preset="longText"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('date')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('roomType')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
              </tr>
            </thead>
            <tbody>
              {stopSells.map((s) => (
                <tr key={s.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{s.date.slice(0, 10)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{s.roomType?.code ?? tc('all')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <button
                      type="button"
                      onClick={() => onRemoveStopSell(s.id)}
                      className={GHOST_BUTTON_CLASS}
                    >
                      {tc('remove')}
                    </button>
                  </td>
                </tr>
              ))}
              {stopSells.length === 0 && (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={3} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('noStopSell')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
