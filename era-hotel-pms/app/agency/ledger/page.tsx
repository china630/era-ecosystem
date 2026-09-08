'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DatePicker,
  EraListFilterBar,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import {
  CityLedgerStatementGrid,
  type ClStatementLine,
} from '@/components/CityLedgerStatementGrid';
import { HotelDataGrid } from '@/components/HotelDataGrid';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type LedgerPayload = {
  agencyCode?: string;
  opening: number;
  newCharges: number;
  payments: number;
  cashPaid: number;
  netAmount: number;
  cityLedger: number;
  lines: ClStatementLine[];
};

/**
 * Agency portal — own City Ledger statement only (no Finance push / settle).
 */
export default function AgencyPortalLedgerPage() {
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);
  const [agencyCode, setAgencyCode] = useState('');
  const [ledger, setLedger] = useState<LedgerPayload | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/agency/ledger?from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, 'Load failed');
        return;
      }
      setAgencyCode(data.agencyCode ?? '');
      setLedger(data);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : 'Load failed' });
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <PageHeader
        title="City ledger statement"
        subtitle={
          agencyCode
            ? `Agency ${agencyCode} — read-only period statement`
            : 'Your agency folio charges and payments'
        }
        actions={
          <Link className="text-[13px] text-[#2980B9] hover:underline" href="/agency">
            ← Bookings
          </Link>
        }
      />

      <EraListFilterBar
        resetLabel="Reset"
        onReset={() => {
          const d = todayIso();
          setFrom(d);
          setTo(d);
        }}
      >
        <DatePicker
          label="From"
          value={from}
          onChange={setFrom}
          placeholder="YYYY-MM-DD"
          openCalendarLabel="Open calendar"
        />
        <DatePicker
          label="To"
          value={to}
          onChange={setTo}
          placeholder="YYYY-MM-DD"
          openCalendarLabel="Open calendar"
        />
      </EraListFilterBar>

      <p className="text-[12px] text-[#7F8C8D]">
        Payments and invoice matching are handled by the hotel / Finance. This view shows your
        AGENCY folio activity only.
      </p>

      {ledger ? (
        <>
          <HotelDataGrid<Record<string, unknown>>
            columns={[
              { key: 'label', header: 'Metric' },
              { key: 'value', header: 'Amount' },
            ]}
            rows={[
              { label: 'Opening', value: `${ledger.opening.toFixed(2)} AZN` },
              { label: 'New charges', value: `${ledger.newCharges.toFixed(2)} AZN` },
              { label: 'Payments (net)', value: `${ledger.payments.toFixed(2)} AZN` },
              { label: 'Cash paid', value: `${ledger.cashPaid.toFixed(2)} AZN` },
              { label: 'Net amount', value: `${ledger.netAmount.toFixed(2)} AZN` },
              { label: 'Closing / city ledger', value: `${ledger.cityLedger.toFixed(2)} AZN` },
            ]}
            rowKey={(r) => String(r.label)}
          />
          <PageHeader title="Statement lines" subtitle="Charges, payments, refunds with running balance" />
          <CityLedgerStatementGrid
            lines={ledger.lines ?? []}
            labels={{
              date: 'Date',
              kind: 'Kind',
              stay: 'Stay',
              guest: 'Guest',
              room: 'Room',
              description: 'Description',
              amount: 'Amount',
              running: 'Running',
              empty: 'No folio activity in this period',
              kindCharge: 'Charge',
              kindPayment: 'Payment',
              kindRefund: 'Refund',
              azn: 'AZN',
            }}
          />
        </>
      ) : null}
    </main>
  );
}
