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

  if (loading && !preview) {
    return (
      <div className="rounded-lg border border-[#D5DADF] bg-[#F8FAFC] p-3 text-[12px] text-[#7F8C8D]">
        {tc('loading')}
      </div>
    );
  }

  if (!preview) return null;

  const hasFees = preview.earlyFee > 0 || preview.lateFee > 0;

  return (
    <div className="rounded-lg border border-[#D5DADF] bg-[#F8FAFC] p-3 text-[12px]">
      <p className="mb-2 font-semibold text-[#34495E]">{t('earlyLate.title')}</p>
      <p className="text-[#7F8C8D]">
        {t('earlyLate.standardTimes', {
          checkIn: preview.policy.standardCheckInTime,
          checkOut: preview.policy.standardCheckOutTime,
        })}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <span className="text-[#7F8C8D]">{t('earlyLate.earlyFee')}</span>
          <p className={`font-mono font-medium ${preview.earlyFee > 0 ? 'text-[#E67E22]' : 'text-[#34495E]'}`}>
            {preview.earlyFee.toFixed(2)} AZN
          </p>
        </div>
        <div>
          <span className="text-[#7F8C8D]">{t('earlyLate.lateFee')}</span>
          <p className={`font-mono font-medium ${preview.lateFee > 0 ? 'text-[#E67E22]' : 'text-[#34495E]'}`}>
            {preview.lateFee.toFixed(2)} AZN
          </p>
        </div>
      </div>
      <p className="mt-1 text-[#7F8C8D]">
        {t('earlyLate.nightlyRate', { rate: preview.nightlyRate.toFixed(2) })}
      </p>
      {!hasFees ? (
        <p className="mt-1 text-[#27AE60]">{t('earlyLate.noFees')}</p>
      ) : (
        <p className="mt-1 text-[#7F8C8D]">{t('earlyLate.previewHint')}</p>
      )}
    </div>
  );
}
