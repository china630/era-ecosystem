'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  DatePicker,
  EraListFilterBar,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
  showWarning,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import ReservationCardModal from '@/components/ReservationCardModal';
import { hotelDateKey } from '@/lib/hotel-calendar';
import FinanceBoundaryBanner from '@/components/FinanceBoundaryBanner';
import { financeDeepLink } from '@/lib/finance-links';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  reservationId: string;
  checkoutSettlementStatus: string;
  guestName: string;
  roomNumber: string | null;
  checkOutDate: string;
  agencyName: string | null;
  companyName: string | null;
  agencyId: string | null;
  companyId: string | null;
  payerBalance: number;
  pendingArFolioIds: string[];
  transferredArFolioIds: string[];
};

function todayIso() {
  return hotelDateKey();
}

export default function UnsettledDeparturesPage() {
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const { can } = useAuth();
  const canRetry = can(PERMISSIONS.FOLIO_PAYMENT);
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [cardReservationId, setCardReservationId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from,
        to,
        status,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/front-cash/unsettled-departures?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        setRows([]);
        setTotal(0);
        return;
      }
      const payload = data.data ?? data;
      setRows(Array.isArray(payload.items) ? payload.items : []);
      setTotal(Number(payload.total) || 0);
    } catch {
      showApiError({ error: tc('loadError') });
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [from, to, status, q, page, pageSize, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function retryInvoice(folioId: string) {
    const res = await fetch(`/api/folios/${folioId}/retry-cl-invoice`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('unsettledRetryInvoiceOk'));
    await load();
  }

  async function pushSnapshot(row: Row) {
    if (row.agencyId) {
      const res = await fetch(`/api/agencies/${row.agencyId}/city-ledger-snapshot`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('pushSnapshotOk'));
    } else if (row.companyId) {
      const res = await fetch(`/api/companies/${row.companyId}/city-ledger-snapshot`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('pushSnapshotOk'));
    } else {
      showWarning(t('unsettledNoParty'));
    }
    await load();
  }

  return (
    <>
      <PageHeader title={t('unsettledDeparturesTitle')} />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          const d = todayIso();
          setFrom(d);
          setTo(d);
          setStatus('ALL');
          setQ('');
          setPage(1);
        }}
      >
        <Field label={tc('search')} preset="longText" value={q} onChange={(e) => setQ(e.target.value)} />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('unsettledStatus')}
          value={status}
          onChange={(v) => {
            setStatus(String(v ?? 'ALL'));
            setPage(1);
          }}
          options={[
            { value: 'ALL', label: tc('all') },
            { value: 'PENDING', label: t('settlementStatus_PENDING') },
            { value: 'INVOICED', label: t('settlementStatus_INVOICED') },
            { value: 'SETTLED', label: t('settlementStatus_SETTLED') },
          ]}
          emptyLabel={null}
        />
        <DatePicker
          label={tc('from')}
          value={from}
          onChange={(v) => {
            setFrom(v);
            setPage(1);
          }}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <DatePicker
          label={tc('to')}
          value={to}
          onChange={(v) => {
            setTo(v);
            setPage(1);
          }}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>

      <FinanceBoundaryBanner target="counterparties" />

      <HotelDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'checkOutDate', header: t('unsettledCheckout'), sortable: true },
          { key: 'guestName', header: t('colName'), sortable: true },
          {
            key: 'roomNumber',
            header: t('unsettledRoom'),
            sortable: true,
            render: (r) => r.roomNumber ?? '—',
          },
          {
            key: 'agencyName',
            header: t('agency'),
            render: (r) => r.agencyName ?? '—',
          },
          {
            key: 'companyName',
            header: t('company'),
            render: (r) => r.companyName ?? '—',
          },
          {
            key: 'checkoutSettlementStatus',
            header: t('unsettledStatus'),
            render: (r) =>
              t(`settlementStatus_${r.checkoutSettlementStatus}` as 'settlementStatus_PENDING'),
          },
          {
            key: 'payerBalance',
            header: t('cityLedger'),
            sortable: true,
            sortValue: (r) => r.payerBalance,
            render: (r) => `${r.payerBalance.toFixed(2)} ${tc('azn')}`,
          },
          {
            key: 'actions',
            header: tc('actions'),
            render: (r) => (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-[13px] text-[#2980B9] hover:underline"
                  onClick={() => setCardReservationId(r.reservationId)}
                >
                  {t('unsettledOpenStay')}
                </button>
                {canRetry && r.pendingArFolioIds[0] ? (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => void retryInvoice(r.pendingArFolioIds[0]!)}
                  >
                    {t('unsettledRetryInvoice')}
                  </button>
                ) : null}
                {canRetry && (r.agencyId || r.companyId) ? (
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    onClick={() => void pushSnapshot(r)}
                  >
                    {t('pushSnapshot')}
                  </button>
                ) : null}
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
            ),
          },
        ]}
        rows={rows as (Row & Record<string, unknown>)[]}
        rowKey={(r) => r.reservationId}
        emptyMessage={loading ? tc('loading') : t('unsettledEmpty')}
        paginationMode="server"
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
      />
      <ReservationCardModal
        open={Boolean(cardReservationId)}
        reservationId={cardReservationId}
        initialTab="folio"
        onClose={() => {
          setCardReservationId(null);
          void load();
        }}
      />
    </>
  );
}
