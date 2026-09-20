'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Field,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SUBSECTION_SURFACE_CLASS,
  TEXT_MUTED_CLASS,
} from '@era/satellite-kit/ui';
import type { DailyRateRow } from './types';

export type PackageComposeSummary = {
  total: number;
  lines: Array<{ code?: string; label?: string; amount: number }>;
};

/** Rate grid on reservation card (HOT-BOOK-07) — dailyRates + optional packageCompose summary. */
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
  packageCompose,
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
  packageCompose?: PackageComposeSummary | null;
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
    <div className="space-y-3" data-testid="reservation-pricing-tab">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[13px] font-semibold text-[#34495E]">{t('rateGridTitle')}</p>
        <p className="m-0 text-right text-lg font-semibold text-[#34495E]">
          {isCreate && dailyRates.length === 0
            ? (quoteText ?? tb('quotePending'))
            : `${t('total')}: ${stayTotal.toFixed(2)} AZN`}
        </p>
      </div>

      <div
        className={`${SUBSECTION_SURFACE_CLASS} flex flex-nowrap items-end gap-2 overflow-x-auto`}
        data-testid="pricing-toolbar"
      >
        <label className="flex items-center gap-2 pb-1 text-[12px]">
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
        <div className="overflow-x-auto rounded-md border border-[#D5DADF]">
          <table className="w-full font-mono text-[12px]" data-testid="rate-grid-table">
            <thead className="bg-[#F8FAFC]">
              <tr>
                <th className="p-2 text-left">{t('stayDate')}</th>
                <th className="p-2 text-right">{t('amount')}</th>
                <th className="p-2 text-right">{t('nightDiscountPct')}</th>
                <th className="p-2 text-center">{t('nightFixed')}</th>
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
                  <td className="p-2 text-right">
                    {d.discountPct != null && Number(d.discountPct) > 0
                      ? `${Number(d.discountPct).toFixed(2)}%`
                      : '—'}
                  </td>
                  <td className="p-2 text-center">
                    {d.manualFlag || d.fixPrice ? t('nightFixed') : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : isCreate && quoteText ? (
        <div className={`${SUBSECTION_SURFACE_CLASS} text-[13px]`} data-testid="pricing-quote-preview">
          <p className="m-0 font-medium text-[#34495E]">{t('quotePreview')}</p>
          <p className={`m-0 mt-1 ${TEXT_MUTED_CLASS}`}>{quoteText}</p>
        </div>
      ) : (
        <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{tb('quotePending')}</p>
      )}

      {packageCompose && packageCompose.lines.length > 0 ? (
        <div className={SUBSECTION_SURFACE_CLASS} data-testid="package-compose-summary">
          <p className="m-0 mb-1 text-[12px] font-semibold text-[#34495E]">
            {t('packageComposeSummary')}: {packageCompose.total.toFixed(2)} AZN
          </p>
          <ul className="m-0 list-none space-y-0.5 p-0 text-[12px] text-[#34495E]">
            {packageCompose.lines.map((l, i) => (
              <li key={`${l.code ?? l.label ?? i}-${i}`} className="flex justify-between gap-2">
                <span>{l.label ?? l.code ?? '—'}</span>
                <span className="font-mono">{Number(l.amount).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
