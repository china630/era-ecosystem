'use client';

import { useTranslations } from 'next-intl';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  GHOST_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { EraModal } from '@/components/EraModal';
import type { ChannelHealth } from './types';

export function ChannelHealthDetailsModal({
  open,
  health,
  onClose,
}: {
  open: boolean;
  health: ChannelHealth | null;
  onClose: () => void;
}) {
  const t = useTranslations('channel');
  const tc = useTranslations('common');
  const flags = health?.envFlags ? Object.entries(health.envFlags) : [];

  return (
    <EraModal open={open} title={t('healthDetails')} subtitle={t('healthHint')} onClose={onClose}>
      <div className="space-y-3 text-[13px] text-[#34495E]">
        <div>
          <span className="text-[#7F8C8D]">{t('healthAdapter')}: </span>
          {health?.adapter ?? tc('dash')}
        </div>
        <div>
          <span className="text-[#7F8C8D]">{t('healthMode')}: </span>
          {health
            ? health.mode === 'live'
              ? t('healthModeLive')
              : t('healthModeDryRun')
            : tc('dash')}
        </div>
        {flags.length === 0 ? (
          <p className="m-0 text-[#7F8C8D]">{t('healthNoEnvFlags')}</p>
        ) : (
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('healthEnvFlag')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('status')}</th>
              </tr>
            </thead>
            <tbody>
              {flags.map(([key, ready]) => (
                <tr key={key} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{key}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {ready ? t('healthEnvYes') : t('healthEnvNo')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button type="button" className={GHOST_BUTTON_CLASS} onClick={onClose}>
          {tc('close')}
        </button>
      </div>
    </EraModal>
  );
}
