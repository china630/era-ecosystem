'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type InboxRow = {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  agency?: { code: string; name: string } | null;
  guest?: { fullName: string } | null;
  roomType?: { code: string; name: string } | null;
  salesContract?: { code: string } | null;
};

export default function AgencyInboxPage() {
  const { can } = useAuth();
  const t = useTranslations('agencyInbox');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/fo/agency-inbox');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    if (can(PERMISSIONS.RESERVATIONS_READ)) void load();
  }, [can, load]);

  async function act(reservationId: string, action: 'confirm' | 'decline') {
    setBusy(true);
    try {
      const res = await fetch('/api/fo/agency-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(action === 'confirm' ? t('confirmed') : t('declined'));
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    } finally {
      setBusy(false);
    }
  }

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <HotelDataGrid<InboxRow & Record<string, unknown>>
        columns={[
          {
            key: 'agency',
            header: t('agency'),
            render: (r) => r.agency?.code ?? '—',
          },
          {
            key: 'guest',
            header: t('guest'),
            render: (r) => r.guest?.fullName ?? '—',
          },
          {
            key: 'roomType',
            header: t('roomType'),
            render: (r) => r.roomType?.code ?? '—',
          },
          {
            key: 'checkInDate',
            header: t('checkIn'),
            render: (r) => String(r.checkInDate).slice(0, 10),
          },
          {
            key: 'checkOutDate',
            header: t('checkOut'),
            render: (r) => String(r.checkOutDate).slice(0, 10),
          },
          {
            key: 'contract',
            header: t('contract'),
            render: (r) => r.salesContract?.code ?? '—',
          },
          {
            key: 'actions',
            header: tc('actions'),
            render: (r) =>
              can(PERMISSIONS.RESERVATIONS_WRITE) ? (
                <span className="flex gap-2">
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void act(r.id, 'confirm')}
                  >
                    {t('confirm')}
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void act(r.id, 'decline')}
                  >
                    {t('decline')}
                  </button>
                </span>
              ) : (
                '—'
              ),
          },
        ]}
        rows={rows as (InboxRow & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
      />
    </>
  );
}
