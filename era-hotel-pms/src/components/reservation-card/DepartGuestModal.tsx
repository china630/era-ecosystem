'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DatePicker,
  CatalogField,
  Field,
  TEXT_MUTED_CLASS,
} from '@era/satellite-kit/ui';
import { bakuTimeLabel } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { EraModal, EraModalFooter } from '@/components/EraModal';

export function DepartGuestModal({
  open,
  guestLabel,
  onClose,
  onConfirm,
  busy,
  ownsFolio = false,
  occupancyPreview,
}: {
  open: boolean;
  guestLabel: string;
  onClose: () => void;
  onConfirm: (input: {
    departedAt: string;
    folioMode: 'LEAVE_ON_PRIMARY' | 'CLOSE_PERSONAL';
  }) => void;
  busy?: boolean;
  /** When false, CLOSE_PERSONAL is hidden (PRIMARY companion shares primary folio). */
  ownsFolio?: boolean;
  occupancyPreview?: string | null;
}) {
  const t = useTranslations('reservationCard');
  const tc = useTranslations('common');
  const [date, setDate] = useState(() => hotelDateKey());
  const [time, setTime] = useState(() => bakuTimeLabel(new Date()));
  const [folioMode, setFolioMode] = useState<'LEAVE_ON_PRIMARY' | 'CLOSE_PERSONAL'>(
    'LEAVE_ON_PRIMARY',
  );

  const folioOptions = [
    { value: 'LEAVE_ON_PRIMARY', label: t('departFolioLeave') },
    ...(ownsFolio
      ? [{ value: 'CLOSE_PERSONAL' as const, label: t('departFolioClose') }]
      : []),
  ];

  return (
    <EraModal
      open={open}
      title={t('departGuest')}
      subtitle={guestLabel}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          busy={busy}
          submitDisabled={busy || !date}
          submitLabel={t('confirmDepartGuest')}
          onSubmit={() =>
            onConfirm({
              departedAt: new Date(`${date}T${time || '12:00'}:00`).toISOString(),
              folioMode: ownsFolio ? folioMode : 'LEAVE_ON_PRIMARY',
            })
          }
        />
      }
    >
      <div className="space-y-3">
        <p className="m-0 text-[13px] text-[#34495E]">{t('departGuestHint')}</p>
        {occupancyPreview ? (
          <p className={`m-0 text-[12px] ${TEXT_MUTED_CLASS}`} data-testid="depart-occupancy-preview">
            {occupancyPreview}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <DatePicker
            label={t('departDate')}
            fluid
            value={date}
            onChange={setDate}
            placeholder={tc('datePlaceholder')}
            openCalendarLabel={tc('openCalendar')}
          />
          <Field
            label={t('departTime')}
            preset="time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('departFolioMode')}
          value={folioMode}
          onChange={(v) =>
            setFolioMode(
              ((Array.isArray(v) ? v[0] : v) as 'LEAVE_ON_PRIMARY' | 'CLOSE_PERSONAL') ||
                'LEAVE_ON_PRIMARY',
            )
          }
          options={folioOptions}
        />
      </div>
    </EraModal>
  );
}
