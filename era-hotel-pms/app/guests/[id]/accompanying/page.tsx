'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PageHeader, EraListFilterBar,
  useDebouncedValue, Field, CARD_CONTAINER_CLASS } from '@era/satellite-kit/ui';
import { useGuestCrmList } from '@/components/guest-crm/useGuestCrmList';
import GuestCardModal from '@/components/GuestCardModal';
import ReservationCardModal from '@/components/ReservationCardModal';

export default function GuestAccompanyingPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const { rows } = useGuestCrmList(`/api/guests/${id}/accompanying`);
  const [q, setQ] = useState('');
  const [openGuestId, setOpenGuestId] = useState<string | null>(null);
  const [openReservationId, setOpenReservationId] = useState<string | null>(null);
  const debouncedQ = useDebouncedValue(q, 300);

  const filtered = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.firstName, r.lastName, r.roomNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [rows, debouncedQ]);

  return (
    <>
      <PageHeader
        title={t('crmPages.accompanyingTitle')}
        leading={
          <Link href="/guests" className="text-[13px] text-[#2980B9] hover:underline">
            {t('crmPages.backToGuests')}
          </Link>
        }
      />
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
      {filtered.length === 0 ? (
        <p className="text-[13px] text-[#7F8C8D]">{t('crmPages.empty')}</p>
      ) : (
        <ul className={`${CARD_CONTAINER_CLASS} space-y-2 p-3 text-[13px]`}>
          {filtered.map((r) => {
            const name = [r.firstName, r.lastName].filter(Boolean).join(' ') || '—';
            const room = String(r.roomNumber ?? '—');
            const label = `${name} · ${t('crmFields.roomNumber')} ${room}`;
            const linkedGuest = r.guestId ? String(r.guestId) : '';
            const reservationId = r.reservationId ? String(r.reservationId) : '';
            return (
              <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
                {linkedGuest || reservationId ? (
                  <button
                    type="button"
                    className="text-left text-[#2980B9] hover:underline"
                    onClick={() => {
                      if (linkedGuest) setOpenGuestId(linkedGuest);
                      else setOpenReservationId(reservationId);
                    }}
                  >
                    {label}
                  </button>
                ) : (
                  label
                )}
              </li>
            );
          })}
        </ul>
      )}
      {openGuestId ? (
        <GuestCardModal open guestId={openGuestId} onClose={() => setOpenGuestId(null)} />
      ) : null}
      {openReservationId ? (
        <ReservationCardModal
          open
          reservationId={openReservationId}
          onClose={() => setOpenReservationId(null)}
        />
      ) : null}
    </>
  );
}
