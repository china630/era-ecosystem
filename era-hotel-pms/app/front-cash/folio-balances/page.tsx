'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  FilterMenuButton,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type FolioBalanceTab =
  | 'inHouse'
  | 'inHouseBalanced'
  | 'inHouseGuestBalanced'
  | 'reservation';

type Row = {
  id: string;
  resNo: string | null;
  status: string;
  roomNumber: string | null;
  guestName: string;
  agencyName: string | null;
  companyName: string | null;
  checkInDate: string;
  checkOutDate: string;
  guestBalance: number;
  agencyBalance: number;
  companyBalance: number;
  roomCharges: number;
  extraCharges: number;
  firstGuestBalance: number | null;
  secondGuestBalance: number | null;
};

function money(n: number | null) {
  if (n == null) return '—';
  return n.toFixed(2);
}

export default function FolioBalancesPage() {
  const { can } = useAuth();
  const t = useTranslations('folioBalances');
  const tc = useTranslations('common');
  const [tab, setTab] = useState<FolioBalanceTab>('inHouse');
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/front-cash/folio-balances?tab=${tab}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tab, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!can(PERMISSIONS.FOLIO_READ)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="mb-3">
        <FilterMenuButton
          label={t('tabLabel')}
          value={tab}
          options={[
            { value: 'inHouse', label: t('tabInHouse') },
            { value: 'inHouseBalanced', label: t('tabAnyBalance') },
            { value: 'inHouseGuestBalanced', label: t('tabGuestBalance') },
            { value: 'reservation', label: t('tabReservation') },
          ]}
          onChange={(v) => setTab(v as FolioBalanceTab)}
        />
      </div>
      <HotelDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'roomNumber', header: t('colRoom'), render: (r) => r.roomNumber ?? '—' },
          { key: 'guestName', header: t('colGuests') },
          { key: 'agencyName', header: t('colAgency'), render: (r) => r.agencyName ?? '—' },
          { key: 'companyName', header: t('colCompany'), render: (r) => r.companyName ?? '—' },
          {
            key: 'checkInDate',
            header: t('colDates'),
            render: (r) =>
              `${String(r.checkInDate).slice(0, 10)} → ${String(r.checkOutDate).slice(0, 10)}`,
          },
          { key: 'guestBalance', header: t('colGuestBal'), render: (r) => money(r.guestBalance) },
          { key: 'agencyBalance', header: t('colAgencyBal'), render: (r) => money(r.agencyBalance) },
          {
            key: 'companyBalance',
            header: t('colCompanyBal'),
            render: (r) => money(r.companyBalance),
          },
          { key: 'roomCharges', header: t('colRoomChg'), render: (r) => money(r.roomCharges) },
          { key: 'extraCharges', header: t('colExtraChg'), render: (r) => money(r.extraCharges) },
          {
            key: 'firstGuestBalance',
            header: t('colFirst'),
            render: (r) => money(r.firstGuestBalance),
          },
          {
            key: 'secondGuestBalance',
            header: t('colSecond'),
            render: (r) => money(r.secondGuestBalance),
          },
          {
            key: 'open',
            header: tc('actions'),
            render: (r) => (
              <Link href={`/folio/${r.id}`} className="text-[#2980B9] hover:underline">
                {t('openFolio')}
              </Link>
            ),
          },
        ]}
        rows={rows as (Row & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
        emptyMessage={t('empty')}
      />
    </>
  );
}
