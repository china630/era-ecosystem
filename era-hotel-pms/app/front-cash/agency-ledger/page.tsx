'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  DatePicker,
  EraListFilterBar,
  FieldSelect,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import FinanceBoundaryBanner from '@/components/FinanceBoundaryBanner';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { financeDeepLink } from '@/lib/finance-links';

interface Party {
  id: string;
  code: string;
  name: string;
}

interface Ledger {
  opening: number;
  newCharges: number;
  payments: number;
  cashPaid: number;
  netAmount: number;
  cityLedger: number;
  closing: number;
  reservationCount: number;
}

interface SummaryRow {
  partyId: string;
  code: string;
  name: string;
  settlementMode: string;
  commissionPercent: number | null;
  cityLedger: number;
  cashPaid: number;
  netAmount: number;
}

interface TransferredRow {
  id: string;
  type: string;
  reservationId: string;
  balance: number;
}

interface SnapshotMeta {
  at: string;
  action: string;
  changes: { asOfDate?: string; result?: { balance?: number; correlationId?: string } } | null;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AgencyLedgerPage() {
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const [agencies, setAgencies] = useState<Party[]>([]);
  const [agencyId, setAgencyId] = useState('');
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [transferred, setTransferred] = useState<TransferredRow[]>([]);
  const [lastSnapshot, setLastSnapshot] = useState<SnapshotMeta | null>(null);

  useEffect(() => {
    const f = searchParams.get('from');
    const t0 = searchParams.get('to');
    if (f) setFrom(f);
    if (t0) setTo(t0);
  }, [searchParams]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/agencies');
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, tc('loadError'));
          return;
        }
        setAgencies(Array.isArray(data) ? data : []);
      } catch (e) {
        showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
      }
    })();
  }, [tc]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `/api/reports/agency-cl-summary?from=${from}&to=${to}&kind=AGENCY`,
        );
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, tc('loadError'));
          return;
        }
        setSummary(Array.isArray(data) ? data : []);
      } catch (e) {
        showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
      }
    })();
  }, [from, to, tc]);

  useEffect(() => {
    if (!agencyId) {
      setLedger(null);
      setTransferred([]);
      setLastSnapshot(null);
      return;
    }
    void (async () => {
      try {
        const [ledgerRes, trRes, snapRes] = await Promise.all([
          fetch(`/api/agencies/${agencyId}/ledger?from=${from}&to=${to}`),
          fetch(`/api/agencies/${agencyId}/settlement`),
          fetch(`/api/agencies/${agencyId}/city-ledger-snapshot`),
        ]);
        const data = await ledgerRes.json();
        if (!ledgerRes.ok) {
          showApiError(data, tc('loadError'));
          return;
        }
        setLedger(data);
        const tr = await trRes.json();
        if (trRes.ok && Array.isArray(tr)) setTransferred(tr);
        const snap = await snapRes.json();
        if (snapRes.ok) setLastSnapshot(snap.lastSnapshot ?? null);
      } catch (e) {
        showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
      }
    })();
  }, [agencyId, from, to, tc]);

  async function pushSnapshotNow() {
    if (!agencyId) return;
    try {
      const res = await fetch(`/api/agencies/${agencyId}/city-ledger-snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asOfDate: to }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('snapshotPushed'));
      const snapRes = await fetch(`/api/agencies/${agencyId}/city-ledger-snapshot`);
      if (snapRes.ok) {
        const snap = await snapRes.json();
        setLastSnapshot(snap.lastSnapshot ?? null);
      }
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    }
  }

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader title={t('agencyLedgerTitle')} />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          const d = todayIso();
          setFrom(d);
          setTo(d);
          setAgencyId('');
          setLedger(null);
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
          label={t('agency')}
          preset="select"
          value={agencyId}
          onChange={(e) => setAgencyId(e.target.value)}
        >
          <option value="">{t('agencySelect')}</option>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </FieldSelect>
      </EraListFilterBar>

      <FinanceBoundaryBanner target="counterparties" />

      <HotelDataGrid<SummaryRow & Record<string, unknown>>
        columns={[
          {
            key: 'code',
            header: t('colCode'),
            render: (r) => (
              <button
                type="button"
                className="text-[#2980B9] hover:underline"
                onClick={() => setAgencyId(r.partyId)}
              >
                {r.code}
              </button>
            ),
          },
          { key: 'name', header: t('colName') },
          {
            key: 'settlementMode',
            header: t('settlementMode'),
            render: (r) => t(`settlement_${r.settlementMode}` as 'settlement_POSTPAID'),
          },
          {
            key: 'commissionPercent',
            header: t('commissionPct'),
            render: (r) => (r.commissionPercent == null ? '—' : String(r.commissionPercent)),
          },
          {
            key: 'cityLedger',
            header: t('cityLedger'),
            render: (r) => `${r.cityLedger.toFixed(2)} ${tc('azn')}`,
          },
          {
            key: 'cashPaid',
            header: t('cashPaid'),
            render: (r) => `${r.cashPaid.toFixed(2)} ${tc('azn')}`,
          },
          {
            key: 'netAmount',
            header: t('netAmount'),
            render: (r) => `${r.netAmount.toFixed(2)} ${tc('azn')}`,
          },
        ]}
        rows={summary as (SummaryRow & Record<string, unknown>)[]}
        rowKey={(r) => r.partyId}
        emptyMessage={t('noAgencies')}
      />

      {ledger && agencyId ? (
        <>
          <PageHeader
            title={t('agencyDetail')}
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  onClick={() => void pushSnapshotNow()}
                >
                  {t('pushSnapshot')}
                </button>
                {financeDeepLink('salesInvoices') ? (
                  <a
                    className="self-center text-[13px] text-[#2980B9] hover:underline"
                    href={financeDeepLink('salesInvoices')!}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('openFinanceAr')}
                  </a>
                ) : null}
              </div>
            }
          />
          {lastSnapshot ? (
            <p className="mb-2 text-[12px] text-[#7F8C8D]">
              {t('lastSnapshotMeta', {
                at: new Date(lastSnapshot.at).toLocaleString(),
                asOf: lastSnapshot.changes?.asOfDate ?? '—',
                balance:
                  lastSnapshot.changes?.result?.balance != null
                    ? String(lastSnapshot.changes.result.balance)
                    : '—',
                correlationId: lastSnapshot.changes?.result?.correlationId ?? '—',
              })}
            </p>
          ) : (
            <p className="mb-2 text-[12px] text-[#7F8C8D]">{t('noSnapshotYet')}</p>
          )}
          <HotelDataGrid<Record<string, unknown>>
            columns={[
              { key: 'label', header: t('metric') },
              { key: 'value', header: tc('amount') },
            ]}
            rows={[
              { label: t('opening'), value: `${ledger.opening.toFixed(2)} ${tc('azn')}` },
              { label: t('newCharges'), value: `${ledger.newCharges.toFixed(2)} ${tc('azn')}` },
              { label: t('payments'), value: `${ledger.payments.toFixed(2)} ${tc('azn')}` },
              { label: t('cashPaid'), value: `${ledger.cashPaid.toFixed(2)} ${tc('azn')}` },
              { label: t('netAmount'), value: `${ledger.netAmount.toFixed(2)} ${tc('azn')}` },
              { label: t('cityLedger'), value: `${ledger.cityLedger.toFixed(2)} ${tc('azn')}` },
            ]}
            rowKey={(r) => String(r.label)}
          />
          {transferred.length > 0 ? (
            <section className="mt-4 rounded-lg border border-[#E8EEF2] p-4">
              <h3 className="mb-2 text-sm font-semibold text-[#34495E]">
                {t('transferredArTitle', { count: transferred.length })}
              </h3>
              <ul className="mb-3 space-y-1 text-[13px] text-[#7F8C8D]">
                {transferred.map((row) => (
                  <li key={row.id}>
                    {row.type} · {row.reservationId.slice(0, 8)} · {row.balance.toFixed(2)}{' '}
                    {tc('azn')}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-[#7F8C8D]">{t('financeBankMatchHint')}</p>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
