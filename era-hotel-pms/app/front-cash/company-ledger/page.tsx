'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  DatePicker,
  EraListFilterBar,
  FieldSelect,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import FinanceBoundaryBanner from '@/components/FinanceBoundaryBanner';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

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
  cityLedger: number;
  cashPaid: number;
  netAmount: number;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function CompanyLedgerPage() {
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const [companies, setCompanies] = useState<Party[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [summary, setSummary] = useState<SummaryRow[]>([]);

  useEffect(() => {
    const f = searchParams.get('from');
    const t0 = searchParams.get('to');
    if (f) setFrom(f);
    if (t0) setTo(t0);
  }, [searchParams]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/companies');
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, tc('loadError'));
          return;
        }
        setCompanies(Array.isArray(data) ? data : []);
      } catch (e) {
        showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
      }
    })();
  }, [tc]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `/api/reports/agency-cl-summary?from=${from}&to=${to}&kind=COMPANY`,
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
    if (!companyId) {
      setLedger(null);
      return;
    }
    void (async () => {
      try {
        const ledgerRes = await fetch(
          `/api/companies/${companyId}/ledger?from=${from}&to=${to}`,
        );
        const data = await ledgerRes.json();
        if (!ledgerRes.ok) {
          showApiError(data, tc('loadError'));
          return;
        }
        setLedger(data);
      } catch (e) {
        showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
      }
    })();
  }, [companyId, from, to, tc]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader title={t('companyLedgerTitle')} subtitle={t('companyLedgerSubtitle')} />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          const d = todayIso();
          setFrom(d);
          setTo(d);
          setCompanyId('');
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
          label={t('company')}
          preset="select"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        >
          <option value="">{t('companySelect')}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
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
                onClick={() => setCompanyId(r.partyId)}
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
        emptyMessage={t('noCompanies')}
      />

      {ledger && companyId ? (
        <>
          <PageHeader title={t('companyDetail')} />
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
        </>
      ) : null}
    </>
  );
}
