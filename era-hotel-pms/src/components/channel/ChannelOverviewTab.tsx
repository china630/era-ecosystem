'use client';

import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import type { ChannelHealth } from './types';

function formatSyncTime(iso: string | null, neverLabel: string) {
  if (!iso) return neverLabel;
  return new Date(iso).toLocaleString();
}

export function ChannelOverviewTab({
  health,
  channelCount,
  openErrorCount,
  availFrom,
  availTo,
  onAvailFrom,
  onAvailTo,
  syncBusy,
  onPush,
  onPull,
  onOpenCancelOta,
  onOpenHealthDetails,
  onGoTab,
}: {
  health: ChannelHealth | null;
  channelCount: number;
  openErrorCount: number;
  availFrom: string;
  availTo: string;
  onAvailFrom: (v: string) => void;
  onAvailTo: (v: string) => void;
  syncBusy: 'push' | 'pull' | null;
  onPush: () => void;
  onPull: () => void;
  onOpenCancelOta: () => void;
  onOpenHealthDetails: () => void;
  onGoTab: (tab: 'channels' | 'journal') => void;
}) {
  const t = useTranslations('channel');
  const tc = useTranslations('common');

  return (
    <div className="space-y-4">
      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('healthTitle')}</h2>
            <p className="mt-1 text-[13px] text-[#7F8C8D]">{t('healthHint')}</p>
          </div>
          <button type="button" className={GHOST_BUTTON_CLASS} onClick={onOpenHealthDetails}>
            {t('healthDetails')}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-[12px]">
          <span className="rounded-lg border border-[#D5DADF] bg-[#F8FAFC] px-2.5 py-1 text-[#34495E]">
            <span className="text-[#7F8C8D]">{t('healthAdapter')}: </span>
            {health?.adapter ?? tc('dash')}
          </span>
          <span className="rounded-lg border border-[#D5DADF] bg-[#F8FAFC] px-2.5 py-1 text-[#34495E]">
            <span className="text-[#7F8C8D]">{t('healthMode')}: </span>
            {health
              ? health.mode === 'live'
                ? t('healthModeLive')
                : t('healthModeDryRun')
              : tc('dash')}
          </span>
          <span className="rounded-lg border border-[#D5DADF] bg-[#F8FAFC] px-2.5 py-1 text-[#34495E]">
            <span className="text-[#7F8C8D]">{t('healthEnvReady')}: </span>
            {health ? (health.envReady ? t('healthEnvYes') : t('healthEnvNo')) : tc('dash')}
          </span>
          <span className="rounded-lg border border-[#D5DADF] bg-[#F8FAFC] px-2.5 py-1 text-[#34495E]">
            <span className="text-[#7F8C8D]">{t('healthAutoPush')}: </span>
            {health
              ? health.channelAutoPushEnabled
                ? t('healthAutoPushOn')
                : t('healthAutoPushOff')
              : tc('dash')}
          </span>
          <span className="rounded-lg border border-[#D5DADF] bg-[#F8FAFC] px-2.5 py-1 text-[#34495E]">
            <span className="text-[#7F8C8D]">{t('lastPush')}: </span>
            {formatSyncTime(health?.lastPushAt ?? null, t('neverSynced'))}
          </span>
          <span className="rounded-lg border border-[#D5DADF] bg-[#F8FAFC] px-2.5 py-1 text-[#34495E]">
            <span className="text-[#7F8C8D]">{t('lastPull')}: </span>
            {formatSyncTime(health?.lastPullAt ?? null, t('neverSynced'))}
          </span>
          <span
            className={`rounded-lg border px-2.5 py-1 ${
              health?.lastError
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-[#D5DADF] bg-[#F8FAFC] text-[#34495E]'
            }`}
          >
            <span className="text-[#7F8C8D]">{t('lastError')}: </span>
            {health?.lastError
              ? `${health.lastError.errorMessage} (${health.lastError.status})`
              : tc('dash')}
          </span>
        </div>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h2 className="mb-1 text-sm font-semibold text-[#34495E]">{t('otaSync')}</h2>
        <p className="mb-3 text-[13px] text-[#7F8C8D]">{t('otaSyncHint')}</p>
        <div className="mb-3 flex flex-wrap items-end gap-3">
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
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={syncBusy !== null}
            onClick={onPush}
          >
            {syncBusy === 'push' ? t('pushing') : t('pushAvailability')}
          </button>
          <button
            type="button"
            className={GHOST_BUTTON_CLASS}
            disabled={syncBusy !== null}
            onClick={onPull}
          >
            {syncBusy === 'pull' ? t('pulling') : t('pullReservations')}
          </button>
          <button type="button" className={GHOST_BUTTON_CLASS} onClick={onOpenCancelOta}>
            {t('cancelOta')}
          </button>
        </div>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('overviewSummary')}</h2>
        <div className="flex flex-wrap gap-3 text-[13px]">
          <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => onGoTab('channels')}>
            {t('overviewChannelsLink', { count: channelCount })}
          </button>
          <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => onGoTab('journal')}>
            {t('overviewErrorsLink', { count: openErrorCount })}
          </button>
        </div>
      </section>
    </div>
  );
}
