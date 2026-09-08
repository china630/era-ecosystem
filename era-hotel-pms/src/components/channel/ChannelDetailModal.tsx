'use client';

import { useTranslations } from 'next-intl';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { EraModal } from '@/components/EraModal';
import type { ChannelMappingRow } from './types';

export function ChannelDetailModal({
  open,
  channel,
  onClose,
  onMapRoom,
  onMapRate,
}: {
  open: boolean;
  channel: ChannelMappingRow | null;
  onClose: () => void;
  onMapRoom: () => void;
  onMapRate: () => void;
}) {
  const t = useTranslations('channel');
  const tc = useTranslations('common');

  return (
    <EraModal
      open={open}
      title={channel ? `${channel.code} · ${channel.name}` : t('openChannelDetail')}
      subtitle={t('mappingsHint')}
      onClose={onClose}
    >
      {!channel ? (
        <p className="m-0 text-[13px] text-[#7F8C8D]">{tc('dash')}</p>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="m-0 text-[13px] font-semibold text-[#34495E]">{t('roomMappings')}</h3>
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={onMapRoom}>
                {t('mapRoomType')}
              </button>
            </div>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('roomType')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('otaRoomCode')}</th>
                </tr>
              </thead>
              <tbody>
                {channel.roomMappings.map((m) => (
                  <tr key={m.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{m.roomType.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{m.otaRoomCode}</td>
                  </tr>
                ))}
                {channel.roomMappings.length === 0 && (
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td colSpan={2} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                      {t('noRoomMappings')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="m-0 text-[13px] font-semibold text-[#34495E]">{t('rateMappings')}</h3>
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={onMapRate}>
                {t('mapRatePlan')}
              </button>
            </div>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('ratePlan')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('otaRateCode')}</th>
                </tr>
              </thead>
              <tbody>
                {channel.rateMappings.map((m) => (
                  <tr key={m.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{m.ratePlan.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{m.otaRateCode}</td>
                  </tr>
                ))}
                {channel.rateMappings.length === 0 && (
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td colSpan={2} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                      {t('noRateMappings')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button type="button" className={GHOST_BUTTON_CLASS} onClick={onClose}>
            {tc('close')}
          </button>
        </div>
      )}
    </EraModal>
  );
}
