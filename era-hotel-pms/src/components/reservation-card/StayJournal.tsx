'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { CatalogField } from '@era/satellite-kit/ui';
import {
  JOURNAL_ACTION_GROUPS,
  guestNameHint,
  journalActionGroup,
  parseAuditFieldKey,
  type JournalActionGroup,
  type ReservationAuditField,
  type ReservationAuditSection,
  type ReservationAuditSource,
  type StayJournalEntry,
} from '@/lib/reservation-journal';

type JournalT = (key: string, values?: Record<string, string | number>) => string;

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

const PLAIN_FIELD_KEYS = [
  'status',
  'checkInDate',
  'checkOutDate',
  'roomType',
  'givenRoomType',
  'roomNumber',
  'ratePlan',
  'mealPlan',
  'paymentMethod',
  'billingMode',
  'source',
  'agency',
  'company',
  'contract',
  'walkInProfile',
  'adults',
  'children11_6',
  'children5_2',
  'children1_0',
  'voucherNo',
  'resNo',
  'market',
  'segment',
  'vipType',
  'tripReason',
  'creditLimitAzn',
  'useManualRate',
  'manualDailyRate',
  'discountPercent',
  'isLocked',
  'guestCount',
  'amount',
  'revenueCode',
  'folioType',
  'reason',
] as const;

const SECTIONS: ReservationAuditSection[] = ['card', 'guests', 'nights', 'notes', 'status', 'folio'];
const SOURCES: ReservationAuditSource[] = ['user', 'elektraweb', 'night_audit', 'system'];
const ACTION_GROUPS = Object.keys(JOURNAL_ACTION_GROUPS) as JournalActionGroup[];
const MONEY_KEYS = new Set(['amount', 'creditLimitAzn', 'manualDailyRate', 'discountPercent']);

function dash(value: string | null | undefined): string {
  return value && value.trim() ? value : '—';
}

function actionLabel(t: JournalT, action: string): string {
  return (ACTION_KEYS as readonly string[]).includes(action)
    ? t(`stayJournalAction.${action}`)
    : action;
}

function ymdDisplay(ymd: string): string {
  const [year, month, day] = ymd.split('-');
  if (!year || !month || !day) return ymd;
  return `${day}.${month}.${year}`;
}

function formatFieldValue(
  t: JournalT,
  tRes: (key: string) => string,
  key: string,
  value: string | null | undefined,
): string {
  if (!value || !value.trim()) return '—';
  if (value === 'true') return t('stayJournalYes');
  if (value === 'false') return t('stayJournalNo');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return ymdDisplay(value);
  if (key === 'status') {
    try {
      return tRes(value);
    } catch {
      return value;
    }
  }
  const parsed = parseAuditFieldKey(key);
  const money =
    MONEY_KEYS.has(key) || (parsed.kind === 'night' && parsed.attr === 'amount');
  if (money && /^-?\d+(\.\d+)?$/.test(value)) return `${value} AZN`;
  return value;
}

function fieldLabel(
  t: JournalT,
  key: string,
  fields: ReservationAuditField[],
): string {
  const parsed = parseAuditFieldKey(key);
  if (parsed.kind === 'guest') {
    const attr = t(`stayJournalFieldKey.guest.${parsed.attr}`);
    const name = guestNameHint(fields, parsed.guestId);
    return name ? `${attr} · ${name}` : attr;
  }
  if (parsed.kind === 'night') {
    const [, month, day] = parsed.ymd.split('-');
    return t(`stayJournalFieldKey.night.${parsed.attr}`, {
      date: day && month ? `${day}.${month}` : parsed.ymd,
    });
  }
  if (parsed.kind === 'note') {
    return t('stayJournalFieldKey.note', { type: parsed.noteType });
  }
  if ((PLAIN_FIELD_KEYS as readonly string[]).includes(parsed.key)) {
    return t(`stayJournalFieldKey.${parsed.key}`);
  }
  return parsed.key;
}

function entrySummary(
  t: JournalT,
  tRes: (key: string) => string,
  entry: StayJournalEntry,
): string {
  if (entry.action === 'CREATE') return t('stayJournalCreatedShort');
  const fields = entry.fields;
  if (fields.length === 0) return actionLabel(t, entry.action);
  const guestCount = fields.find((item) => item.key === 'guestCount');
  if (guestCount) {
    return t('stayJournalSummaryGuests', {
      from: dash(guestCount.from),
      to: dash(guestCount.to),
    });
  }
  const room = fields.find((item) => item.key === 'roomNumber');
  if (room) {
    return t('stayJournalSummaryRoom', { from: dash(room.from), to: dash(room.to) });
  }
  const status = fields.find((item) => item.key === 'status');
  if (status) {
    return t('stayJournalSummaryStatus', {
      from: formatFieldValue(t, tRes, 'status', status.from),
      to: formatFieldValue(t, tRes, 'status', status.to),
    });
  }
  const nights = fields.filter((item) => /^night\.\d{4}-\d{2}-\d{2}\.amount$/.test(item.key));
  if (nights.length > 1) {
    return t('stayJournalSummaryNights', { count: nights.length });
  }
  if (nights.length === 1) {
    const parsed = parseAuditFieldKey(nights[0]!.key);
    const date = parsed.kind === 'night' ? ymdDisplay(parsed.ymd) : nights[0]!.key;
    return t('stayJournalSummaryNight', {
      date,
      from: formatFieldValue(t, tRes, nights[0]!.key, nights[0]!.from),
      to: formatFieldValue(t, tRes, nights[0]!.key, nights[0]!.to),
    });
  }
  const amount = fields.find((item) => item.key === 'amount');
  if (amount) {
    return t('stayJournalSummaryAmount', {
      amount: formatFieldValue(t, tRes, 'amount', amount.to ?? amount.from),
    });
  }
  const first = fields[0]!;
  return `${fieldLabel(t, first.key, fields)}: ${formatFieldValue(t, tRes, first.key, first.from)} → ${formatFieldValue(t, tRes, first.key, first.to)}`;
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
  const tRes = useTranslations('reservationStatus');
  const [actionGroup, setActionGroup] = useState('');
  const [section, setSection] = useState('');
  const [actor, setActor] = useState('');
  const [source, setSource] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const actors = useMemo(() => {
    const names = new Set<string>();
    for (const row of entries) {
      if (row.actor) names.add(row.actor);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const visible = useMemo(() => {
    return entries.filter((row) => {
      if (actionGroup) {
        const group = journalActionGroup(row.action);
        if (group !== actionGroup) return false;
      }
      if (section && row.section !== section) return false;
      if (source && row.source !== source) return false;
      if (actor === '__system__') {
        if (row.actor) return false;
      } else if (actor && row.actor !== actor) {
        return false;
      }
      return true;
    });
  }, [entries, actionGroup, section, actor, source]);

  function catalogValue(next: string | string[]): string {
    return Array.isArray(next) ? (next[0] ?? '') : next;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('stayJournalAction')}
          value={actionGroup}
          onChange={(next) => setActionGroup(catalogValue(next))}
          options={ACTION_GROUPS.map((id) => ({
            value: id,
            label: t(`stayJournalActionGroup.${id}`),
          }))}
          emptyLabel={t('stayJournalFilterAll')}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('stayJournalSectionLabel')}
          value={section}
          onChange={(next) => setSection(catalogValue(next))}
          options={SECTIONS.map((id) => ({
            value: id,
            label: t(`stayJournalSection.${id}`),
          }))}
          emptyLabel={t('stayJournalFilterAll')}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('stayJournalActor')}
          value={actor}
          onChange={(next) => setActor(catalogValue(next))}
          options={[
            { value: '__system__', label: t('stayJournalActorSystem') },
            ...actors.map((name) => ({ value: name, label: name })),
          ]}
          emptyLabel={t('stayJournalFilterAll')}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('stayJournalSourceLabel')}
          value={source}
          onChange={(next) => setSource(catalogValue(next))}
          options={SOURCES.map((id) => ({
            value: id,
            label: t(`stayJournalSource.${id}`),
          }))}
          emptyLabel={t('stayJournalFilterAll')}
        />
      </div>
      {loading ? (
        <p className="m-0 text-[13px] text-[#7F8C8D]">{t('stayJournalLoading')}</p>
      ) : error ? (
        <p className="m-0 text-[13px] text-[#7F8C8D]">{t('stayJournalLoadError')}</p>
      ) : visible.length === 0 ? (
        <p className="m-0 text-[13px] text-[#7F8C8D]">
          {entries.length === 0 ? t('stayJournalEmpty') : t('stayJournalNoMatch')}
        </p>
      ) : (
        <ul className="m-0 list-none divide-y divide-[#E8EEF2] p-0">
          {visible.map((row) => {
            const open = openId === row.id;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 py-2.5 text-left"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : row.id)}
                >
                  <span className="min-w-0">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
                      {actionLabel(t, row.action)}
                      {' · '}
                      {t(`stayJournalSection.${row.section}` as 'stayJournalSection.card')}
                    </span>
                    <span className="block text-[13px] font-medium text-[#34495E]">
                      {entrySummary(t, tRes, row)}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-[#7F8C8D]">
                      {row.actor ?? t('stayJournalActorSystem')}
                      {' · '}
                      {t(`stayJournalSource.${row.source}` as 'stayJournalSource.user')}
                      {row.ipAddress ? ` · ${row.ipAddress}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[12px] text-[#7F8C8D]">
                    {bakuDateTimeDisplay(row.createdAt)}
                  </span>
                </button>
                {open && row.fields.length > 0 ? (
                  <div className="overflow-x-auto pb-3">
                    <table className="w-full border-collapse text-left text-[12px] text-[#34495E]">
                      <thead>
                        <tr className="border-b border-[#E8EEF2] text-[#7F8C8D]">
                          <th className="py-1 pr-3 font-medium">{t('stayJournalField')}</th>
                          <th className="py-1 pr-3 font-medium">{t('stayJournalFrom')}</th>
                          <th className="py-1 font-medium">{t('stayJournalTo')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.fields.map((field) => (
                          <tr key={`${row.id}:${field.key}`} className="border-b border-[#F0F4F6]">
                            <td className="py-1 pr-3 font-medium">
                              {fieldLabel(t, field.key, row.fields)}
                            </td>
                            <td className="py-1 pr-3">
                              {formatFieldValue(t, tRes, field.key, field.from)}
                            </td>
                            <td className="py-1">
                              {formatFieldValue(t, tRes, field.key, field.to)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {open && row.fields.length === 0 ? (
                  <p className="m-0 pb-3 text-[12px] text-[#7F8C8D]">{t('stayJournalNoFieldDiff')}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
