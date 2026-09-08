'use client';

import { HotelDataGrid } from '@/components/HotelDataGrid';

export type ClStatementLine = {
  id: string;
  kind: 'CHARGE' | 'PAYMENT' | 'REFUND';
  at: string;
  businessDate: string | null;
  reservationId: string;
  reservationRef: string | null;
  guestName: string | null;
  roomLabel: string | null;
  folioId: string;
  folioStatus: string;
  description: string;
  code: string | null;
  qty: number | null;
  amount: number;
  runningBalance: number;
};

type Labels = {
  date: string;
  kind: string;
  stay: string;
  guest: string;
  room: string;
  description: string;
  amount: string;
  running: string;
  empty: string;
  kindCharge: string;
  kindPayment: string;
  kindRefund: string;
  azn: string;
};

function kindLabel(kind: ClStatementLine['kind'], labels: Labels) {
  if (kind === 'CHARGE') return labels.kindCharge;
  if (kind === 'REFUND') return labels.kindRefund;
  return labels.kindPayment;
}

export function CityLedgerStatementGrid({
  lines,
  labels,
}: {
  lines: ClStatementLine[];
  labels: Labels;
}) {
  return (
    <HotelDataGrid<ClStatementLine & Record<string, unknown>>
      columns={[
        {
          key: 'businessDate',
          header: labels.date,
          render: (r) => r.businessDate ?? String(r.at).slice(0, 10),
        },
        {
          key: 'kind',
          header: labels.kind,
          render: (r) => kindLabel(r.kind, labels),
        },
        {
          key: 'reservationId',
          header: labels.stay,
          render: (r) => r.reservationRef ?? r.reservationId.slice(0, 8),
        },
        {
          key: 'guestName',
          header: labels.guest,
          render: (r) => r.guestName ?? '—',
        },
        {
          key: 'roomLabel',
          header: labels.room,
          render: (r) => r.roomLabel ?? '—',
        },
        {
          key: 'description',
          header: labels.description,
          render: (r) =>
            r.code ? `${r.code}${r.qty != null && r.qty !== 1 ? ` ×${r.qty}` : ''} · ${r.description}` : r.description,
        },
        {
          key: 'amount',
          header: labels.amount,
          render: (r) => `${r.amount.toFixed(2)} ${labels.azn}`,
        },
        {
          key: 'runningBalance',
          header: labels.running,
          render: (r) => `${r.runningBalance.toFixed(2)} ${labels.azn}`,
        },
      ]}
      rows={lines as (ClStatementLine & Record<string, unknown>)[]}
      rowKey={(r) => r.id}
      emptyMessage={labels.empty}
    />
  );
}
