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
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import type { ChannelMappingRow } from './types';

export function ChannelChannelsTab({
  channels,
  search,
  onSearch,
  onAddChannel,
  onOpenDetail,
}: {
  channels: ChannelMappingRow[];
  search: string;
  onSearch: (v: string) => void;
  onAddChannel: () => void;
  onOpenDetail: (channelId: string) => void;
}) {
  const t = useTranslations('channel');
  const tc = useTranslations('common');

  return (
    <section className={`${CARD_CONTAINER_CLASS} p-4`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('mappingsTitle')}</h2>
          <p className="mt-1 text-[13px] text-[#7F8C8D]">{t('mappingsHint')}</p>
        </div>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={onAddChannel}>
          <Plus className="h-4 w-4" aria-hidden />
          {t('addChannel')}
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
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('code')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('name')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('roomMappings')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('rateMappings')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS} />
            </tr>
          </thead>
          <tbody>
            {channels.map((ch) => (
              <tr key={ch.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{ch.code}</td>
                <td className={DATA_TABLE_TD_CLASS}>{ch.name}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {t('mappingCountRooms', { count: ch.roomMappings.length })}
                </td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {t('mappingCountRates', { count: ch.rateMappings.length })}
                </td>
                <td className={DATA_TABLE_TD_CLASS}>
                  <button
                    type="button"
                    className="text-[#2980B9] hover:underline"
                    onClick={() => onOpenDetail(ch.id)}
                  >
                    {t('openChannelDetail')}
                  </button>
                </td>
              </tr>
            ))}
            {channels.length === 0 && (
              <tr className={DATA_TABLE_TR_CLASS}>
                <td colSpan={5} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                  {t('noChannels')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
