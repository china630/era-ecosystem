'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { showApiError } from '@era/satellite-kit/ui';

type EarlyLatePreview = {
  earlyFee: number;
  lateFee: number;
  nightlyRate: number;
  policy: {
    standardCheckInTime: string;
    standardCheckOutTime: string;
  };
};

export function ReservationCardEarlyLatePanel({
  reservationId,
  checkInTime,
  checkOutTime,
}: {
  reservationId: string;
  checkInTime: string;
  checkOutTime: string;
}) {
  const t = useTranslations('reservationCard');
  const tc = useTranslations('common');
  const [preview, setPreview] = useState<EarlyLatePreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (checkInTime) qs.set('checkInTime', checkInTime);
    if (checkOutTime) qs.set('checkOutTime', checkOutTime);

    let cancelled = false;
    setLoading(true);
    fetch(`/api/reservations/${reservationId}/early-late-fees?${qs}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) {
          setPreview(null);
          return;
        }
        setPreview(json as EarlyLatePreview);
      })
      .catch((e) => {
        if (!cancelled) {
          showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
          setPreview(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reservationId, checkInTime, checkOutTime, tc]);

  if (loading && !preview) return null;

  if (!preview) return null;
  if (preview.earlyFee <= 0 && preview.lateFee <= 0) return null;

  const parts: string[] = [];
  if (preview.earlyFee > 0) {
    parts.push(`${t('earlyLate.earlyFee')} ${preview.earlyFee.toFixed(2)} AZN`);
  }
  if (preview.lateFee > 0) {
    parts.push(`${t('earlyLate.lateFee')} ${preview.lateFee.toFixed(2)} AZN`);
  }

  return (
    <p className="m-0 text-[12px] text-[#E67E22]" data-testid="early-late-fee-line">
      {parts.join(' · ')}
    </p>
  );
}
