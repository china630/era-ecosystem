'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  EraListFilterBar,
  FieldSelect,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type TxRow = {
  id: string;
  createdAt: string;
  amount: number | string;
  paymentMethod: string;
  kind: string;
  folioType: string;
  reservationId: string;
  guestName: string | null;
  roomNumber: string | null;
};

type DepositRow = {
  id: string;
  heldAt: string;
  amount: number | string;
  paymentMethod: string;
  status: string;
  reservationId: string;
  guestName: string;
  roomNumber: string | null;
};

type PendingItem = {
  id: string;
  sourceSystem: string;
  amount: number | string;
  description: string;
  payerLabel: string | null;
};

type ShiftOpt = {
  id: string;
  cashier: string;
  registerId: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
};

type Journal = {
  payments: TxRow[];
  deposits: DepositRow[];
  pending: {
    pendingCount: number;
    pendingAmount: number | string;
    items: PendingItem[];
  };
  openShift: {
    id: string;
    cashier: string;
    registerId: string;
    openedAt: string;
    isPrimary: boolean;
  } | null;
  shifts?: ShiftOpt[];
  zSummary?: {
    cashShiftId: string | null;
    cashier: string | null;
    registerId: string | null;
    openedAt: string | null;
    closedAt: string | null;
    status: string | null;
    totalsByMethod: Journal['totalsByMethod'];
    paymentsNet: number;
    depositsHeld: number;
    pendingCount: number;
    pendingAmount: number;
  };
  totalsByMethod: {
    method: string;
    payments: number;
    refunds: number;
    depositsHeld: number;
    net: number;
  }[];
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function FrontCashTransactionsPage() {
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const t = useTranslations('frontCash');
  const tc = useTranslations('common');
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);
  const [cashShiftId, setCashShiftId] = useState('');
  const [journal, setJournal] = useState<Journal | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const f = searchParams.get('from');
    const t0 = searchParams.get('to');
    if (f) setFrom(f);
    if (t0) setTo(t0);
  }, [searchParams]);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ from, to });
      if (cashShiftId) q.set('cashShiftId', cashShiftId);
      const res = await fetch(`/api/front-cash/transactions?${q}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setJournal(data);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [from, to, cashShiftId, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function closeShift() {
    if (!confirm(t('confirmCloseShift'))) return;
    setBusy(true);
    try {
      const res = await fetch('/api/cash/shifts?action=close', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('shiftClosed'));
      setCashShiftId('');
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    } finally {
      setBusy(false);
    }
  }

  function printZ() {
    window.print();
  }

  if (!can(PERMISSIONS.FOLIO_READ) && !can(PERMISSIONS.FOLIO_PAYMENT)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  const payments = journal?.payments ?? [];
  const deposits = journal?.deposits ?? [];
  const pending = journal?.pending;
  const totals = journal?.totalsByMethod ?? [];
  const shifts = journal?.shifts ?? [];
  const z = journal?.zSummary;

  return (
    <>
      <PageHeader
        title={t('transactionsTitle')}
        subtitle={t('transactionsSubtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={printZ}>
              {t('printZ')}
            </button>
            {journal?.openShift && can(PERMISSIONS.CASH_SHIFT) ? (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void closeShift()}
              >
                {t('closeShift')}
              </button>
            ) : null}
          </div>
        }
      />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          const d = todayIso();
          setFrom(d);
          setTo(d);
          setCashShiftId('');
        }}
      >
        <DatePicker
          label={tc('from')}
          value={from}
          onChange={setFrom}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <DatePicker
          label={tc('to')}
          value={to}
          onChange={setTo}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <FieldSelect
          label={t('cashShift')}
          preset="select"
          value={cashShiftId}
          onChange={(e) => setCashShiftId(e.target.value)}
        >
          <option value="">{t('allShifts')}</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.status} · {s.cashier} · {new Date(s.openedAt).toLocaleString()}
            </option>
          ))}
        </FieldSelect>
      </EraListFilterBar>

      {z ? (
        <section
          className={`${CARD_CONTAINER_CLASS} mb-3 space-y-1 p-3 text-[13px] text-[#34495E] print:border print:shadow-none`}
          id="z-report"
        >
          <h2 className="m-0 text-sm font-semibold">{t('zTitle')}</h2>
          <p className="m-0 text-[12px] text-[#7F8C8D]">
            {z.cashier ?? '—'} · {z.registerId ?? '—'} · {z.status ?? '—'}
          </p>
          <p className="m-0">
            {t('zNet')}: {z.paymentsNet.toFixed(2)} {tc('azn')} · {t('zHeld')}:{' '}
            {z.depositsHeld.toFixed(2)} · {t('pendingSummary')}: {z.pendingCount} /{' '}
            {Number(z.pendingAmount).toFixed(2)}
          </p>
          <ul className="m-0 list-disc pl-5">
            {z.totalsByMethod.map((row) => (
              <li key={row.method}>
                {row.method}: pay {row.payments.toFixed(2)} / refund {row.refunds.toFixed(2)} /
                net {row.net.toFixed(2)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={`${CARD_CONTAINER_CLASS} mb-3 grid gap-2 p-3 text-[13px] text-[#34495E] md:grid-cols-3 print:hidden`}>
        <div>
          <div className="text-[12px] text-[#7F8C8D]">{t('openShift')}</div>
          {journal?.openShift ? (
            <div>
              {journal.openShift.cashier} · {journal.openShift.registerId}
              {journal.openShift.isPrimary ? ` · ${t('primaryShift')}` : ''}
            </div>
          ) : (
            <div className="text-[#7F8C8D]">{t('noOpenShift')}</div>
          )}
          <Link href="/night-audit" className="text-[#2980B9] hover:underline">
            {t('manageShift')}
          </Link>
        </div>
        <div>
          <div className="text-[12px] text-[#7F8C8D]">{t('pendingSummary')}</div>
          <div>
            {pending?.pendingCount ?? 0} ·{' '}
            {Number(pending?.pendingAmount ?? 0).toFixed(2)} {tc('azn')}
          </div>
          <Link href="/front-cash/pending" className="text-[#2980B9] hover:underline">
            {t('openPending')}
          </Link>
        </div>
        <div>
          <div className="text-[12px] text-[#7F8C8D]">{t('totalsByMethod')}</div>
          {totals.length === 0 ? (
            <div className="text-[#7F8C8D]">{tc('dash')}</div>
          ) : (
            <ul className="m-0 list-none space-y-0.5 p-0">
              {totals.map((row) => (
                <li key={row.method}>
                  {row.method}: {row.net.toFixed(2)} {tc('azn')}
                  {row.depositsHeld > 0
                    ? ` · HELD ${row.depositsHeld.toFixed(2)}`
                    : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <h2 className="mb-2 text-[14px] font-semibold text-[#2C3E50]">{t('paymentsSection')}</h2>
      <section className={`${CARD_CONTAINER_CLASS} mb-4 p-0`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colTime')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colGuest')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colRoom')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colKind')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colMethod')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('amount')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((r) => (
                <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.guestName ?? tc('dash')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.roomNumber ?? tc('dash')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {r.kind}
                    {r.folioType ? ` · ${r.folioType}` : ''}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.paymentMethod}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {Number(r.amount).toFixed(2)} {tc('azn')}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <Link
                      href={`/folio/${r.reservationId}`}
                      className="text-[#2980B9] hover:underline"
                    >
                      {t('openFolio')}
                    </Link>
                  </td>
                </tr>
              ))}
              {payments.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={7} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('transactionsEmpty')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <h2 className="mb-2 text-[14px] font-semibold text-[#2C3E50]">{t('depositsSection')}</h2>
      <section className={`${CARD_CONTAINER_CLASS} p-0`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colTime')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colGuest')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colRoom')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colStatus')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colMethod')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('amount')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((r) => (
                <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {new Date(r.heldAt).toLocaleString()}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.guestName}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.roomNumber ?? tc('dash')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.status}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.paymentMethod}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {Number(r.amount).toFixed(2)} {tc('azn')}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <Link
                      href={`/folio/${r.reservationId}`}
                      className="text-[#2980B9] hover:underline"
                    >
                      {t('openFolio')}
                    </Link>
                  </td>
                </tr>
              ))}
              {deposits.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={7} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('depositsEmpty')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
