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
  Field,
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import type { SyncError } from './types';

export function ChannelJournalTab({
  errors,
  search,
  onSearch,
  onLogError,
  onResolve,
}: {
  errors: SyncError[];
  search: string;
  onSearch: (v: string) => void;
  onLogError: () => void;
  onResolve: (id: string) => void;
}) {
  const t = useTranslations('channel');
  const tc = useTranslations('common');

  return (
    <section className={`${CARD_CONTAINER_CLASS} p-4`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('syncJournal')}</h2>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={onLogError}>
          <Plus className="h-4 w-4" aria-hidden />
          {t('logSyncError')}
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
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('otaRef')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('message')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('status')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS} />
            </tr>
          </thead>
          <tbody>
            {errors.map((e) => (
              <tr key={e.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{e.otaReference ?? tc('dash')}</td>
                <td className={DATA_TABLE_TD_CLASS}>{e.errorMessage}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {e.status === 'RESOLVED' ? t('resolved') : t('open')}
                </td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {e.status === 'OPEN' && (
                    <button
                      type="button"
                      onClick={() => onResolve(e.id)}
                      className={GHOST_BUTTON_CLASS}
                    >
                      {tc('resolve')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {errors.length === 0 && (
              <tr className={DATA_TABLE_TR_CLASS}>
                <td colSpan={4} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                  {tc('dash')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
