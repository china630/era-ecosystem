'use client';

import { useTranslations } from 'next-intl';
import { FORM_FIELD_GROUP_CLASS, MODAL_FIELD_LABEL_CLASS, MODAL_INPUT_CLASS, PRIMARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import type { DailyRateRow } from './types';

export function ReservationCardPricingTab({
  isCreate,
  quoteText,
  totalAmount,
  dailyRates,
  useManualRate,
  manualDailyRate,
  discountActive,
  busy,
  isLocked,
  onDailyRates,
  onToggle,
  onManualRate,
  onRecalc,
  onChargeAll,
}: {
  isCreate: boolean;
  quoteText: string | null;
  totalAmount: number;
  dailyRates: DailyRateRow[];
  useManualRate: boolean;
  manualDailyRate: string;
  discountActive: boolean;
  busy: boolean;
  isLocked: boolean;
  onDailyRates: (rows: DailyRateRow[]) => void;
  onToggle: (key: 'useManualRate' | 'discountActive', value: boolean) => void;
  onManualRate: (value: string) => void;
  onRecalc: () => void;
  onChargeAll: () => void;
}) {
  const t = useTranslations('reservationCard');
  const tb = useTranslations('booking');

  return (
    <div className="space-y-4">
      <p className="text-right text-lg font-semibold text-[#34495E]">
        {isCreate ? (quoteText ?? tb('quotePending')) : `${t('total')}: ${totalAmount.toFixed(2)} AZN`}
      </p>
      {!isCreate ? (
        <div className="flex flex-wrap items-center gap-4 text-[13px]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useManualRate} disabled={isLocked} onChange={(e) => onToggle('useManualRate', e.target.checked)} />
            {t('useManualRate')}
          </label>
          {useManualRate ? (
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('manualDailyRate')}</label>
              <input
                type="number"
                step="0.01"
                className={MODAL_INPUT_CLASS}
                value={manualDailyRate}
                disabled={isLocked}
                onChange={(e) => onManualRate(e.target.value)}
              />
            </div>
          ) : null}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={discountActive} disabled={isLocked} onChange={(e) => onToggle('discountActive', e.target.checked)} />
            {t('discountActive')}
          </label>
        </div>
      ) : null}
      {!isCreate && dailyRates.length > 0 ? (
        <table className="w-full font-mono text-[12px]">
          <thead className="bg-[#F8FAFC]">
            <tr>
              <th className="p-2 text-left">{t('stayDate')}</th>
              <th className="p-2 text-left">{t('currency')}</th>
              <th className="p-2 text-right">{t('amount')}</th>
              <th className="p-2 text-center">{t('fixPrice')}</th>
              <th className="p-2 text-right">{t('discountPct')}</th>
              <th className="p-2 text-center">{t('manualFlag')}</th>
            </tr>
          </thead>
          <tbody>
            {dailyRates.map((d, i) => (
              <tr key={d.stayDate} className="border-t border-[#D5DADF]">
                <td className="p-2">{d.stayDate}</td>
                <td className="p-2">
                  <input
                    className={`${MODAL_INPUT_CLASS} w-16`}
                    value={d.currencyCode ?? 'AZN'}
                    disabled={isLocked}
                    onChange={(e) => {
                      const next = [...dailyRates];
                      next[i] = { ...d, currencyCode: e.target.value };
                      onDailyRates(next);
                    }}
                  />
                </td>
                <td className="p-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    className={`${MODAL_INPUT_CLASS} w-24 text-right`}
                    value={d.amount}
                    disabled={isLocked}
                    onChange={(e) => {
                      const next = [...dailyRates];
                      next[i] = { ...d, amount: Number(e.target.value) };
                      onDailyRates(next);
                    }}
                  />
                </td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={Boolean(d.fixPrice)}
                    disabled={isLocked}
                    onChange={(e) => {
                      const next = [...dailyRates];
                      next[i] = { ...d, fixPrice: e.target.checked };
                      onDailyRates(next);
                    }}
                  />
                </td>
                <td className="p-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    className={`${MODAL_INPUT_CLASS} w-16 text-right`}
                    value={d.discountPct ?? ''}
                    disabled={isLocked}
                    onChange={(e) => {
                      const next = [...dailyRates];
                      next[i] = {
                        ...d,
                        discountPct: e.target.value === '' ? null : Number(e.target.value),
                      };
                      onDailyRates(next);
                    }}
                  />
                </td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={Boolean(d.manualFlag)}
                    disabled={isLocked}
                    onChange={(e) => {
                      const next = [...dailyRates];
                      next[i] = { ...d, manualFlag: e.target.checked };
                      onDailyRates(next);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : !isCreate ? (
        <p className="text-[13px] text-[#7F8C8D]">{tb('quotePending')}</p>
      ) : null}
      {!isCreate ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-[#E74C3C] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
            disabled={busy || isLocked}
            onClick={onRecalc}
          >
            {t('calcDaily')}
          </button>
          <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy || isLocked} onClick={onChargeAll}>
            {t('chargeAll')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
