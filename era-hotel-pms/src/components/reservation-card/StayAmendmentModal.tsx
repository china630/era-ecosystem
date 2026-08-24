'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  DatePicker,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal } from '@/components/EraModal';
import type { RatePlanOption, SelectOption } from './types';

export function StayAmendmentModal({
  open,
  reservationId,
  roomTypes,
  ratePlans,
  defaultRoomTypeId,
  defaultRatePlanId,
  onClose,
  onApplied,
}: {
  open: boolean;
  reservationId: string | null;
  roomTypes: SelectOption[];
  ratePlans: RatePlanOption[];
  defaultRoomTypeId: string;
  defaultRatePlanId: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const t = useTranslations('reservationCard');
  const tc = useTranslations('common');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [roomTypeId, setRoomTypeId] = useState(defaultRoomTypeId);
  const [ratePlanId, setRatePlanId] = useState(defaultRatePlanId);
  const [preview, setPreview] = useState<{
    nights: Array<{ date: string; old: number; next: number; locked: boolean }>;
    folioImpact: string;
    differenceAmount: number;
    lockedNights: string[];
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const roomTypeOptions = useMemo(
    () => roomTypes.map((r) => ({ value: r.id, label: r.label })),
    [roomTypes],
  );
  const ratePlanOptions = useMemo(() => {
    const medical = ratePlans.filter((p) => p.medicalFlag);
    const rest = ratePlans.filter((p) => !p.medicalFlag);
    return [...medical, ...rest].map((p) => ({
      value: p.id,
      label: p.medicalFlag ? `${p.label} (pkg)` : p.label,
    }));
  }, [ratePlans]);

  if (!open || !reservationId) return null;

  async function runPreview() {
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/amendments/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ effectiveDate, roomTypeId, ratePlanId }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      setPreview(json.data ?? json);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/amendments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ effectiveDate, roomTypeId, ratePlanId }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      showSuccess(t('amendApplied'));
      onApplied();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <EraModal
      open={open}
      title={t('amendProduct')}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onClose}>
            {tc('cancel')}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={busy || !effectiveDate}
            onClick={() => void runPreview()}
          >
            {t('preview')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !preview}
            onClick={() => void apply()}
          >
            {t('applyAmendment')}
          </button>
        </div>
      }
    >
      <p className="mb-3 text-[12px] text-[#7F8C8D]">{t('amendFolioHint')}</p>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <DatePicker
          label={t('effectiveDate')}
          value={effectiveDate}
          onChange={(v) => {
            setEffectiveDate(v);
            setPreview(null);
          }}
        />
        <CatalogField
          kind="CLOSED_MEDIUM"
          label={t('roomType')}
          value={roomTypeId}
          onChange={(v) => {
            setRoomTypeId(String(v));
            setPreview(null);
          }}
          options={roomTypeOptions}
        />
        <CatalogField
          kind="SEARCHABLE"
          label={t('ratePlan')}
          value={ratePlanId}
          onChange={(v) => {
            setRatePlanId(String(v));
            setPreview(null);
          }}
          options={ratePlanOptions}
        />
      </div>
      {preview ? (
        <div className="text-[12px]">
          <p className="m-0 mb-2">
            {t('folioImpact')}: {preview.folioImpact}
            {preview.differenceAmount
              ? ` (${preview.differenceAmount > 0 ? '+' : ''}${preview.differenceAmount.toFixed(2)})`
              : ''}
          </p>
          <table className="w-full font-mono">
            <thead>
              <tr>
                <th className="p-1 text-left">{t('stayDate')}</th>
                <th className="p-1 text-right">{t('amount')}</th>
                <th className="p-1 text-right">{t('newAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {preview.nights.map((n) => (
                <tr key={n.date}>
                  <td className="p-1">
                    {n.date}
                    {n.locked ? ` (${t('nightLocked')})` : ''}
                  </td>
                  <td className="p-1 text-right">{n.old.toFixed(2)}</td>
                  <td className="p-1 text-right">{n.next.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </EraModal>
  );
}
