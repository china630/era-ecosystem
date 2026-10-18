'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { TAB_ITEM_ACTIVE_CLASS, TAB_ITEM_CLASS, TAB_STRIP_CLASS } from '@era/satellite-kit/ui';
import type {
  ReservationAuditField,
  ReservationAuditSource,
  StayJournalEntry,
} from '@/lib/reservation-audit';

type TabId = 'feed' | 'fields';

const ACTION_KEYS = [
  'CREATE',
  'UPDATE',
  'CHECK_IN',
  'CHECK_IN_EARLY',
  'CHECK_OUT',
  'CANCEL',
  'NO_SHOW',
  'RESTORE',
  'ASSIGN_ROOM',
  'RELOCATE',
  'SWAP_ROOM',
  'ROOM_MOVE',
  'AMEND',
  'TARIFF_CHANGE',
  'CHARGE',
  'PAYMENT',
  'REFUND',
  'PAYMENT_VOID',
  'VOID',
  'DEPOSIT',
  'DEPOSIT_PAYOUT',
  'DEPOSIT_CARRY',
  'TRANSFER',
  'SETTLE',
  'GUEST_DEBT',
  'GUEST_DEBT_PAY',
  'DEPART_GUEST',
  'MISSED_NIGHTS',
] as const;

function dash(value: string | null | undefined): string {
  return value && value.trim() ? value : '—';
}

function actionLabel(t: (key: string) => string, action: string): string {
  return (ACTION_KEYS as readonly string[]).includes(action)
    ? t(`stayJournalAction.${action}`)
    : action;
}

export function StayJournal({
  entries,
  loading,
  error,
}: {
  entries: StayJournalEntry[];
  loading?: boolean;
  error?: boolean;
}) {
  const t = useTranslations('reservationCard');
  const [tab, setTab] = useState<TabId>('feed');
  const fieldRows = useMemo(() => {
    const rows: Array<{
      id: string;
      createdAt: string;
      action: string;
      actor: string | null;
      source: ReservationAuditSource;
      field: ReservationAuditField;
    }> = [];
    for (const entry of entries) {
      for (const field of entry.fields) {
        rows.push({
          id: `${entry.id}:${field.key}`,
          createdAt: entry.createdAt,
          action: entry.action,
          actor: entry.actor,
          source: entry.source,
          field,
        });
      }
    }
    return rows;
  }, [entries]);

  return (
    <div className="space-y-3">
      <div className={TAB_STRIP_CLASS} role="tablist">
        {(['feed', 'fields'] as TabId[]).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? TAB_ITEM_ACTIVE_CLASS : TAB_ITEM_CLASS}
            onClick={() => setTab(id)}
          >
            {id === 'feed' ? t('stayJournalFeed') : t('stayJournalFields')}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="m-0 text-[13px] text-[#7F8C8D]">{t('stayJournalLoading')}</p>
      ) : error ? (
        <p className="m-0 text-[13px] text-[#7F8C8D]">{t('stayJournalLoadError')}</p>
      ) : tab === 'feed' ? (
        <Feed entries={entries} />
      ) : (
        <Fields rows={fieldRows} />
      )}
    </div>
  );
}

function Feed({ entries }: { entries: StayJournalEntry[] }) {
  const t = useTranslations('reservationCard');
  if (entries.length === 0) {
    return <p className="m-0 text-[13px] text-[#7F8C8D]">{t('stayJournalEmpty')}</p>;
  }
  return (
    <ul className="m-0 list-none space-y-3 p-0">
      {entries.map((row) => (
        <li key={row.id} className="border-b border-[#E8EEF2] pb-3 last:border-b-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px] text-[#34495E]">
            <strong className="font-semibold">{actionLabel(t, row.action)}</strong>
            <span className="text-[#7F8C8D]">{bakuDateTimeDisplay(row.createdAt)}</span>
          </div>
          <p className="m-0 mt-1 text-[12px] text-[#7F8C8D]">
            {t(`stayJournalSection.${row.section}` as 'stayJournalSection.card')}
            {' · '}
            {t(`stayJournalSource.${row.source}` as 'stayJournalSource.user')}
            {' · '}
            {row.actor ?? t('stayJournalActorSystem')}
            {row.ipAddress ? ` · ${row.ipAddress}` : ''}
          </p>
          <p className="m-0 mt-1 text-[13px] text-[#34495E]">
            {row.action === 'CREATE' && row.fields.length === 0
              ? t('stayCreated', { at: bakuDateTimeDisplay(row.createdAt) })
              : row.summary}
          </p>
          {row.fields.length > 0 ? (
            <ul className="m-0 mt-2 list-none space-y-0.5 p-0 text-[12px] text-[#34495E]">
              {row.fields.map((field) => (
                <li key={`${row.id}:${field.key}`}>
                  <span className="font-medium">{field.key}</span>
                  {': '}
                  {dash(field.from)} → {dash(field.to)}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Fields({
  rows,
}: {
  rows: Array<{
    id: string;
    createdAt: string;
    action: string;
    actor: string | null;
    source: ReservationAuditSource;
    field: ReservationAuditField;
  }>;
}) {
  const t = useTranslations('reservationCard');
  if (rows.length === 0) {
    return <p className="m-0 text-[13px] text-[#7F8C8D]">{t('stayJournalEmpty')}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[12px] text-[#34495E]">
        <thead>
          <tr className="border-b border-[#E8EEF2] text-[#7F8C8D]">
            <th className="py-1 pr-3 font-medium">{t('stayJournalTime')}</th>
            <th className="py-1 pr-3 font-medium">{t('stayJournalField')}</th>
            <th className="py-1 pr-3 font-medium">{t('stayJournalFrom')}</th>
            <th className="py-1 pr-3 font-medium">{t('stayJournalTo')}</th>
            <th className="py-1 pr-3 font-medium">{t('stayJournalAction')}</th>
            <th className="py-1 pr-3 font-medium">{t('stayJournalActor')}</th>
            <th className="py-1 font-medium">{t('stayJournalSourceLabel')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[#F0F4F6] align-top">
              <td className="py-1 pr-3 whitespace-nowrap">{bakuDateTimeDisplay(row.createdAt)}</td>
              <td className="py-1 pr-3 font-medium">{row.field.key}</td>
              <td className="py-1 pr-3">{dash(row.field.from)}</td>
              <td className="py-1 pr-3">{dash(row.field.to)}</td>
              <td className="py-1 pr-3">{actionLabel(t, row.action)}</td>
              <td className="py-1 pr-3">{row.actor ?? t('stayJournalActorSystem')}</td>
              <td className="py-1">
                {t(`stayJournalSource.${row.source}` as 'stayJournalSource.user')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}