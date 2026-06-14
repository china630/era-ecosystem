'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  FORM_FIELD_GROUP_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';

type CardAuthRow = {
  id: string;
  amount: number;
  status: string;
  externalAuthId?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
};

export function ReservationCardAuthorizationsPanel({
  reservationId,
  disabled,
}: {
  reservationId: string;
  disabled?: boolean;
}) {
  const t = useTranslations('reservationCard');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<CardAuthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [holdAmount, setHoldAmount] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/card-authorizations`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? tc('loadError'));
      setRows(Array.isArray(json) ? json : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    } finally {
      setLoading(false);
    }
  }, [reservationId, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function placeHold() {
    const amount = Number(holdAmount);
    if (!amount || amount <= 0) {
      showApiError({ error: t('cardAuth.amountInvalid') });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/card-authorizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      showSuccess(t('cardAuth.holdPlaced'));
      setHoldAmount('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function releaseAuth(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/card-authorizations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorizationId: id, action: 'release' }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      showSuccess(t('cardAuth.released'));
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#D5DADF] bg-[#F8FAFC] p-3">
      <p className="mb-2 text-[13px] font-semibold text-[#34495E]">{t('cardAuth.title')}</p>
      {loading ? (
        <p className="text-[12px] text-[#7F8C8D]">{tc('loading')}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] font-mono text-[12px]">
              <thead>
                <tr className="text-left text-[#7F8C8D]">
                  <th className="p-1">{t('amount')}</th>
                  <th className="p-1">{t('cardAuth.status')}</th>
                  <th className="p-1">{t('cardAuth.expires')}</th>
                  <th className="p-1">{t('cardAuth.externalId')}</th>
                  <th className="p-1 text-right">{t('cardAuth.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-2 text-[#7F8C8D]">
                      {t('cardAuth.empty')}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-[#D5DADF]">
                      <td className="p-1">{Number(row.amount).toFixed(2)} AZN</td>
                      <td className="p-1">{t(`cardAuth.statusValue.${row.status}` as 'cardAuth.statusValue.HELD')}</td>
                      <td className="p-1">
                        {row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-1 truncate max-w-[120px]" title={row.externalAuthId ?? undefined}>
                        {row.externalAuthId ?? '—'}
                      </td>
                      <td className="p-1 text-right">
                        {row.status === 'HELD' ? (
                          <button
                            type="button"
                            className={`${SECONDARY_BUTTON_CLASS} text-[11px]`}
                            disabled={disabled || busy}
                            onClick={() => void releaseAuth(row.id)}
                          >
                            {t('cardAuth.release')}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className={`${FORM_FIELD_GROUP_CLASS} min-w-[120px]`}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('cardAuth.holdAmount')}</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                className={MODAL_INPUT_CLASS}
                value={holdAmount}
                disabled={disabled || busy}
                onChange={(e) => setHoldAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <button
              type="button"
              className={`${PRIMARY_BUTTON_CLASS} text-[12px]`}
              disabled={disabled || busy}
              onClick={() => void placeHold()}
            >
              {t('cardAuth.placeHold')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
