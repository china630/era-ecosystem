'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  EraListFilterBar,
  useDebouncedValue,
  Field,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from "@/components/HotelDataGrid";
import GuestCardModal from '@/components/GuestCardModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { matchesCodeNameQuery } from '@/lib/list-filter';

type GuestRow = {
  id: string;
  fullName: string;
  nationality: string;
  phone: string | null;
  globalPersonId: string | null;
};

export default function GuestsPage() {
  const { can } = useAuth();
  const t = useTranslations('guestsPage');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardGuestId, setCardGuestId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/guests');
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
    void load();
  }, [load]);

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesCodeNameQuery(r, debouncedQ)),
    [rows, debouncedQ],
  );

  function openCreate() {
    setCardGuestId(null);
    setCardOpen(true);
  }

  function openEdit(guest: GuestRow) {
    setCardGuestId(guest.id);
    setCardOpen(true);
  }

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => setQ('')}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </EraListFilterBar>
      <HotelDataGrid<GuestRow & Record<string, unknown>>
        columns={[
          { key: 'name', header: t('name'), render: (r) => r.fullName },
          { key: 'nationality', header: t('nationality'), render: (r) => r.nationality },
          { key: 'phone', header: t('phone'), render: (r) => r.phone ?? '—' },
          {
            key: 'mdm',
            header: t('mdmLink'),
            render: (r) =>
              r.globalPersonId ? (
                <span className="text-emerald-700">{t('mdmLinked')}</span>
              ) : (
                <span className="text-[#7F8C8D]">—</span>
              ),
          },
          {
            key: 'actions',
            header: tc('actions'),
            render: (r) =>
              can(PERMISSIONS.RESERVATIONS_WRITE) ? (
                <button
                  type="button"
                  className="text-[#2980B9] hover:underline"
                  onClick={() => openEdit(r)}
                >
                  {t('viewProfile')}
                </button>
              ) : null,
          },
        ]}
        rows={filteredRows as (GuestRow & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
        onAdd={can(PERMISSIONS.RESERVATIONS_WRITE) ? openCreate : undefined}
        addLabel={t('addGuest')}
        emptyMessage={t('empty')}
      />

      <GuestCardModal
        open={cardOpen}
        guestId={cardGuestId}
        onClose={() => {
          setCardOpen(false);
          setCardGuestId(null);
          void load();
        }}
      />
    </>
  );
}
