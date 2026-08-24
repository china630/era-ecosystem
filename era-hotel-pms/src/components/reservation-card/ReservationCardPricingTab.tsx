'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Field,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import type { DailyRateRow } from './types';

export function ReservationCardPricingTab({
  isCreate,
  quoteText,
  totalAmount,
  dailyRates,
  useManualRate,
  manualDailyRate,
  discountPercent,
  busy,
  isLocked,
  onDailyRates,
  onToggleManual,
  onManualRate,
  onDiscountPercent,
  onSpreadNightly,
  onSpreadTotal,
  onApplyPercent,
  onRecalc,
}: {
  isCreate: boolean;
  quoteText: string | null;
  totalAmount: number;
  dailyRates: DailyRateRow[];
  useManualRate: boolean;
  manualDailyRate: string;
  discountPercent: string;
  busy: boolean;
  isLocked: boolean;
  onDailyRates: (rows: DailyRateRow[]) => void;
  onToggleManual: (value: boolean) => void;
  onManualRate: (value: string) => void;
  onDiscountPercent: (value: string) => void;
  onSpreadNightly: () => void;
  onSpreadTotal: (total: number) => void;
  onApplyPercent: () => void;
  onRecalc: () => void;
}) {
  const t = useTranslations('reservationCard');
  const tb = useTranslations('booking');
  const ratesLocked = isLocked || isCreate;
  const [stayTotalDraft, setStayTotalDraft] = useState('');
  const stayTotal = useMemo(
    () => dailyRates.reduce((s, d) => s + Number(d.amount || 0), 0),
    [dailyRates],
  );
  const spreadValue = Number(stayTotalDraft) || stayTotal || totalAmount;

  return (
    <div className="space-y-4">
      <p className="m-0 text-right text-lg font-semibold text-[#34495E]">
        {isCreate || dailyRates.length === 0
          ? (quoteText ?? tb('quotePending'))
          : `${t('total')}: ${stayTotal.toFixed(2)} AZN`}
      </p>
      <div className="flex flex-wrap items-end gap-3 text-[13px]">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useManualRate}
            disabled={ratesLocked}
            onChange={(e) => onToggleManual(e.target.checked)}
          />
          {t('useManualRate')}
        </label>
        {useManualRate ? (
          <>
            <Field
              label={t('manualDailyRate')}
              preset="amount"
              type="number"
              step="0.01"
              value={manualDailyRate}
              disabled={ratesLocked}
              onChange={(e) => onManualRate(e.target.value)}
            />
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={ratesLocked || busy}
              onClick={onSpreadNightly}
            >
              {t('spreadNights')}
            </button>
          </>
        ) : (
          <>
            <Field
              label={t('stayDiscountPct')}
              preset="amount"
              type="number"
              step="0.01"
              value={discountPercent}
              disabled={ratesLocked}
              onChange={(e) => onDiscountPercent(e.target.value)}
            />
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={ratesLocked || busy}
              onClick={onApplyPercent}
            >
              {t('applyStayPct')}
            </button>
          </>
        )}
        <Field
          label={t('stayTotalAmount')}
          preset="amount"
          type="number"
          step="0.01"
          value={stayTotalDraft}
          disabled={ratesLocked}
          onChange={(e) => setStayTotalDraft(e.target.value)}
        />
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={ratesLocked || busy}
          onClick={() => onSpreadTotal(spreadValue)}
        >
          {t('spreadStayTotal')}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={ratesLocked || busy}
          onClick={onRecalc}
        >
          {t('calcDaily')}
        </button>
      </div>
      {dailyRates.length > 0 ? (
        <table className="w-full font-mono text-[12px]">
          <thead className="bg-[#F8FAFC]">
            <tr>
              <th className="p-2 text-left">{t('stayDate')}</th>
              <th className="p-2 text-right">{t('amount')}</th>
              <th className="p-2 text-center">{t('nightLocked')}</th>
            </tr>
          </thead>
          <tbody>
            {dailyRates.map((d, i) => (
              <tr key={d.stayDate} className="border-t border-[#D5DADF]">
                <td className="p-2">{String(d.stayDate).slice(0, 10)}</td>
                <td className="p-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    className="w-24 rounded border border-[#D5DADF] px-1 py-0.5 text-right"
                    value={d.amount}
                    disabled={ratesLocked}
                    onChange={(e) => {
                      const next = [...dailyRates];
                      next[i] = {
                        ...d,
                        amount: Number(e.target.value),
                        manualFlag: true,
                      };
                      onDailyRates(next);
                    }}
                  />
                </td>
                <td className="p-2 text-center">{d.manualFlag ? t('nightLocked') : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-[13px] text-[#7F8C8D]">{tb('quotePending')}</p>
      )}
    </div>
  );
}
