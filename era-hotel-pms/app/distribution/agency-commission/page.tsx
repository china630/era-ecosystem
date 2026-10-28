'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DatePicker,
  EraListFilterBar,
  CatalogField,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type SummaryRow = {
  agencyId: string;
  code: string;
  name: string;
  commissionPercent: number | null;
  accrued: number;
  ready: number;
  inPayment: number;
  paid: number;
  held: number;
  skippedNet: number;
  lineCount: number;
  payable: number;
};

type LineRow = {
  id: string;
  agencyId: string;
  reservationId: string;
  reservationRef: string | null;
  guestName: string | null;
  roomLabel: string | null;
  fromDate: string;
  toDate: string;
  revenueBase: number;
  commissionPercent: number;
  commissionBasis: string;
  amount: number;
  status: string;
};

type ForecastRow = {
  agencyId: string;
  code: string;
  name: string;
  nights: number;
  revenue: number;
  estCommission: number;
  stays: number;
};

type Tab = 'summary' | 'lines' | 'forecast';

function todayIso() {
  return hotelDateKey();
}

export default function AgencyCommissionPage() {
  const { can } = useAuth();
  const t = useTranslations('agencyCommission');
  const tc = useTranslations('common');
  const [tab, setTab] = useState<Tab>('summary');
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);
  const [agencyId, setAgencyId] = useState('');
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [forecast, setForecast] = useState<ForecastRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [agencyOptions, setAgencyOptions] = useState<{ value: string; label: string }[]>([]);

  const canManage = can(PERMISSIONS.MASTER_DATA_MANAGE);

  async function loadSummary() {
    try {
      const res = await fetch(`/api/distribution/agency-commission/summary?from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setSummary(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }

  async function loadLines() {
    try {
      const q = new URLSearchParams({ from, to });
      if (agencyId) q.set('agencyId', agencyId);
      const res = await fetch(`/api/distribution/agency-commission/lines?${q}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setLines(Array.isArray(data) ? data : []);
      setSelected([]);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }

  async function loadForecast() {
    try {
      const res = await fetch(`/api/distribution/agency-commission/forecast?from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setForecast(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/agencies');
        const data = await res.json();
        if (!res.ok || !Array.isArray(data)) return;
        setAgencyOptions(
          data.map((r: { id: string; code: string; name: string }) => ({
            value: r.id,
            label: `${r.code} — ${r.name}`,
          })),
        );
      } catch {
        /* picker stays empty; submit still needs agencyId from summary click */
      }
    })();
  }, []);

  useEffect(() => {
    if (tab === 'summary') void loadSummary();
    else if (tab === 'lines') void loadLines();
    else void loadForecast();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on filters/tab
  }, [from, to, agencyId, tab]);

  async function markReady() {
    if (selected.length === 0) return;
    try {
      const res = await fetch('/api/distribution/agency-commission/lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineIds: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('markedReady', { count: data.updated ?? selected.length }));
      void loadLines();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    }
  }

  async function createAndSubmitBatch() {
    if (!agencyId) {
      showApiError({ error: t('pickAgency') });
      return;
    }
    try {
      const createRes = await fetch('/api/distribution/agency-commission/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId,
          periodFrom: from,
          periodTo: to,
          lineIds: selected.length ? selected : undefined,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) {
        showApiError(created, tc('error'));
        return;
      }
      const submitRes = await fetch(
        `/api/distribution/agency-commission/batches/${created.id}/submit`,
        { method: 'POST' },
      );
      const submitted = await submitRes.json();
      if (!submitRes.ok) {
        showApiError(submitted, tc('error'));
        return;
      }
      showSuccess(t('batchSubmitted'));
      void loadLines();
      void loadSummary();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    }
  }

  async function rebuild() {
    try {
      const res = await fetch('/api/distribution/agency-commission/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agencyId ? { agencyId } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('rebuilt', { count: data.rebuilt ?? data.lines?.length ?? 0 }));
      void loadSummary();
      void loadLines();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    }
  }

  async function holdLine(id: string) {
    const reason = window.prompt(t('holdReasonPrompt'));
    if (!reason?.trim()) return;
    try {
      const res = await fetch(`/api/distribution/agency-commission/lines/${id}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('held'));
      void loadLines();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    }
  }

  async function disputeLine(id: string) {
    const reason = window.prompt(t('disputeReasonPrompt'));
    if (!reason?.trim()) return;
    try {
      const res = await fetch(`/api/distribution/agency-commission/lines/${id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('disputed'));
      void loadLines();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    }
  }

  async function releaseLine(id: string) {
    try {
      const res = await fetch(`/api/distribution/agency-commission/lines/${id}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ release: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('released'));
      void loadLines();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    }
  }

  if (!can(PERMISSIONS.REPORTS_READ) && !can(PERMISSIONS.SCREEN_DISTRIBUTION)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <p className="mb-3 text-[13px] text-[#7F8C8D]">
        {t('arBanner')}{' '}
        <a className="text-[#2980B9] hover:underline" href="/front-cash/agency-ledger">
          {t('openAgencyLedger')}
        </a>
      </p>
      <p className="mb-3 text-[13px] text-[#7F8C8D]">{t('financeOnlyPay')}</p>

      <div className="mb-3 flex flex-wrap gap-2">
        {(['summary', 'lines', 'forecast'] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            className={tab === key ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            onClick={() => setTab(key)}
          >
            {t(`tab_${key}`)}
          </button>
        ))}
      </div>

      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          const d = todayIso();
          setFrom(d);
          setTo(d);
          setAgencyId('');
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
        {tab === 'lines' ? (
          <CatalogField
            kind="ENTITY_REF"
            label={t('agency')}
            value={agencyId}
            onChange={(v) => setAgencyId(String(v ?? ''))}
            options={agencyOptions}
            emptyLabel={t('agencyAll')}
          />
        ) : null}
      </EraListFilterBar>

      {canManage ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void rebuild()}>
            {t('rebuild')}
          </button>
          {tab === 'lines' ? (
            <>
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void markReady()}>
                {t('markReady')}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => void createAndSubmitBatch()}
              >
                {t('submitToFinance')}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {tab === 'summary' ? (
        <HotelDataGrid<SummaryRow & Record<string, unknown>>
          columns={[
            {
              key: 'code',
              header: t('colCode'),
              sortable: true,
              render: (r) => (
                <button
                  type="button"
                  className="text-[#2980B9] hover:underline"
                  onClick={() => {
                    setAgencyId(r.agencyId);
                    setTab('lines');
                  }}
                >
                  {r.code}
                </button>
              ),
            },
            { key: 'name', header: t('colName'), sortable: true },
            {
              key: 'commissionPercent',
              header: t('colPct'),
              sortable: true,
              render: (r) => (r.commissionPercent == null ? '—' : String(r.commissionPercent)),
            },
            {
              key: 'payable',
              header: t('colPayable'),
              sortable: true,
              render: (r) => `${r.payable.toFixed(2)} ${tc('azn')}`,
            },
            {
              key: 'accrued',
              header: t('colAccrued'),
              sortable: true,
              render: (r) => `${r.accrued.toFixed(2)} ${tc('azn')}`,
            },
            {
              key: 'ready',
              header: t('colReady'),
              sortable: true,
              render: (r) => `${r.ready.toFixed(2)} ${tc('azn')}`,
            },
            {
              key: 'paid',
              header: t('colPaid'),
              sortable: true,
              render: (r) => `${r.paid.toFixed(2)} ${tc('azn')}`,
            },
            {
              key: 'lineCount',
              header: t('colLines'),
              sortable: true,
            },
          ]}
          rows={summary as (SummaryRow & Record<string, unknown>)[]}
          rowKey={(r) => r.agencyId}
          emptyMessage={t('emptySummary')}
        />
      ) : null}

      {tab === 'lines' ? (
        <HotelDataGrid<LineRow & Record<string, unknown>>
          columns={[
            {
              key: 'id',
              header: t('colSelect'),
              render: (r) => (
                <input
                  type="checkbox"
                  checked={selected.includes(r.id)}
                  onChange={(e) => {
                    setSelected((prev) =>
                      e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id),
                    );
                  }}
                />
              ),
            },
            {
              key: 'reservationId',
              header: t('colStay'),
              sortable: true,
              render: (r) => r.reservationRef ?? r.reservationId.slice(0, 8),
            },
            {
              key: 'guestName',
              header: t('colGuest'),
              sortable: true,
              render: (r) => r.guestName ?? '—',
            },
            { key: 'fromDate', header: t('colFrom'), sortable: true },
            { key: 'toDate', header: t('colTo'), sortable: true },
            {
              key: 'revenueBase',
              header: t('colBase'),
              sortable: true,
              render: (r) => `${r.revenueBase.toFixed(2)} ${tc('azn')}`,
            },
            {
              key: 'commissionPercent',
              header: t('colPct'),
              sortable: true,
              render: (r) => `${r.commissionPercent}% ${r.commissionBasis}`,
            },
            {
              key: 'amount',
              header: t('colAmount'),
              sortable: true,
              render: (r) => `${r.amount.toFixed(2)} ${tc('azn')}`,
            },
            { key: 'status', header: t('colStatus'), sortable: true },
            {
              key: 'actions',
              header: t('colActions'),
              render: (r) => {
                if (!canManage) return '—';
                if (r.status === 'ON_HOLD' || r.status === 'DISPUTED') {
                  return (
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      onClick={() => void releaseLine(r.id)}
                    >
                      {t('release')}
                    </button>
                  );
                }
                if (r.status === 'ACCRUED' || r.status === 'READY') {
                  return (
                    <span className="flex gap-1">
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => void holdLine(r.id)}
                      >
                        {t('hold')}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => void disputeLine(r.id)}
                      >
                        {t('dispute')}
                      </button>
                    </span>
                  );
                }
                return '—';
              },
            },
          ]}
          rows={lines as (LineRow & Record<string, unknown>)[]}
          rowKey={(r) => r.id}
          emptyMessage={t('emptyLines')}
        />
      ) : null}

      {tab === 'forecast' ? (
        <HotelDataGrid<ForecastRow & Record<string, unknown>>
          columns={[
            { key: 'code', header: t('colCode'), sortable: true },
            { key: 'name', header: t('colName'), sortable: true },
            { key: 'stays', header: t('colStays'), sortable: true },
            { key: 'nights', header: t('colNights'), sortable: true },
            {
              key: 'revenue',
              header: t('colRevenue'),
              sortable: true,
              render: (r) => `${r.revenue.toFixed(2)} ${tc('azn')}`,
            },
            {
              key: 'estCommission',
              header: t('colEstCommission'),
              sortable: true,
              render: (r) => `${r.estCommission.toFixed(2)} ${tc('azn')}`,
            },
          ]}
          rows={forecast as (ForecastRow & Record<string, unknown>)[]}
          rowKey={(r) => r.agencyId}
          emptyMessage={t('emptyForecast')}
        />
      ) : null}
    </>
  );
}
