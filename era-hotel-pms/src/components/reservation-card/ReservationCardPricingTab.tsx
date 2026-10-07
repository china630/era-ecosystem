'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  Field,
  PRIMARY_BUTTON_CLASS,
  SUBSECTION_SURFACE_CLASS,
  TEXT_MUTED_CLASS,
} from '@era/satellite-kit/ui';
import { splitStayAmounts } from '@/lib/services/door-type.policy';
import type { DailyRateRow } from './types';

export type PackageComposeSummary = {
  total: number;
  lines: Array<{ code?: string; label?: string; amount: number }>;
};

type PriceAction = 'manual' | 'discount' | 'total';
type NightKind = 'open' | 'posted' | 'past';

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function nightTariff(row: DailyRateRow, planNightly: number | null): number {
  if (planNightly != null && planNightly > 0) return planNightly;
  const pct = Number(row.discountPct ?? 0);
  if (pct > 0 && pct < 100) return Math.round((row.amount / (1 - pct / 100)) * 100) / 100;
  return row.amount;
}

function sameMoney(values: number[]): number | null {
  if (values.length === 0) return null;
  const first = money(values[0] ?? 0);
  return values.every((value) => money(value) === first) ? Number(first) : null;
}

/** Rate grid: one action bar, scrolling nights, sticky stay total. */
export function ReservationCardPricingTab({
  isCreate,
  quoteText,
  dailyRates,
  manualDailyRate,
  discountPercent,
  busy,
  isLocked,
  packageCompose,
  tariffNightly,
  businessDate,
  postedDates,
  onDailyRates,
  onManualRate,
  onDiscountPercent,
  onUseManual,
}: {
  isCreate: boolean;
  quoteText: string | null;
  dailyRates: DailyRateRow[];
  manualDailyRate: string;
  discountPercent: string;
  busy: boolean;
  isLocked: boolean;
  packageCompose?: PackageComposeSummary | null;
  tariffNightly: number | null;
  businessDate: string | null;
  postedDates: string[];
  onDailyRates: (rows: DailyRateRow[]) => void;
  onManualRate: (value: string) => void;
  onDiscountPercent: (value: string) => void;
  onUseManual: (value: boolean) => void;
}) {
  const t = useTranslations('reservationCard');
  const tb = useTranslations('booking');
  const ratesLocked = isLocked || isCreate;
  const [action, setAction] = useState<PriceAction>('manual');
  const [stayTotalDraft, setStayTotalDraft] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');

  const posted = useMemo(() => new Set(postedDates), [postedDates]);

  function kindOf(stayDate: string): NightKind {
    const key = stayDate.slice(0, 10);
    if (posted.has(key)) return 'posted';
    if (businessDate && key < businessDate) return 'past';
    return 'open';
  }

  const stayTotal = useMemo(
    () => dailyRates.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [dailyRates],
  );

  const targets = dailyRates.filter((row) => kindOf(row.stayDate) === 'open' && !row.fixPrice);
  const targetTariffs = targets.map((row) => nightTariff(row, tariffNightly));
  const commonTariff = sameMoney(targetTariffs);
  const commonFinal = sameMoney(targets.map((row) => row.amount));
  const tariffBase = commonTariff ?? tariffNightly ?? targetTariffs[0] ?? null;

  const percent = Number(discountPercent);
  const previewFinal = (() => {
    if (action === 'manual') {
      const nightly = Number(manualDailyRate);
      return nightly > 0 ? nightly : commonFinal;
    }
    if (action === 'discount') {
      if (tariffBase == null || !(percent >= 0)) return commonFinal;
      return Math.round(tariffBase * (1 - percent / 100) * 100) / 100;
    }
    const total = Number(stayTotalDraft);
    if (!(total > 0) || targets.length === 0) return commonFinal;
    const parts = splitStayAmounts(total, targets.length);
    return sameMoney(parts);
  })();

  function syncDiscountAmount(nextPercent: string, base: number | null) {
    const pct = Number(nextPercent);
    if (base == null || !(pct >= 0)) {
      setDiscountAmount('');
      return;
    }
    setDiscountAmount(money((base * pct) / 100));
  }

  function apply() {
    if (ratesLocked || targets.length === 0) return;
    if (action === 'manual') {
      const nightly = Number(manualDailyRate);
      if (!(nightly > 0)) return;
      onUseManual(true);
      onDailyRates(
        dailyRates.map((row) =>
          kindOf(row.stayDate) === 'open' && !row.fixPrice
            ? { ...row, amount: nightly, manualFlag: true, fixPrice: true, discountPct: null }
            : row,
        ),
      );
      return;
    }
    if (action === 'discount') {
      if (!(percent >= 0) || percent > 100) return;
      onUseManual(false);
      onDailyRates(
        dailyRates.map((row) => {
          if (kindOf(row.stayDate) !== 'open' || row.fixPrice) return row;
          const base = nightTariff(row, tariffNightly);
          const amount = Math.round(base * (1 - percent / 100) * 100) / 100;
          return { ...row, amount, discountPct: percent, manualFlag: false };
        }),
      );
      return;
    }
    const total = Number(stayTotalDraft);
    if (!(total > 0)) return;
    const parts = splitStayAmounts(total, targets.length);
    let index = 0;
    onUseManual(true);
    onDailyRates(
      dailyRates.map((row) => {
        if (kindOf(row.stayDate) !== 'open' || row.fixPrice) return row;
        const amount = parts[index] ?? 0;
        index += 1;
        return { ...row, amount, manualFlag: true, fixPrice: true, discountPct: null };
      }),
    );
    if (parts[0] != null) onManualRate(money(parts[0]));
  }

  const pairLabel = (value: number | null) =>
    value == null ? t('priceMixed') : `${money(value)} AZN`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2" data-testid="reservation-pricing-tab">
      <div
        className={`${SUBSECTION_SURFACE_CLASS} flex shrink-0 flex-wrap items-end gap-2`}
        data-testid="pricing-toolbar"
      >
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('priceAction')}
          value={action}
          emptyLabel={null}
          disabled={ratesLocked}
          options={[
            { value: 'manual', label: t('priceActionManual') },
            { value: 'discount', label: t('priceActionDiscount') },
            { value: 'total', label: t('priceActionTotal') },
          ]}
          onChange={(next) => {
            const picked = (typeof next === 'string' ? next : next[0]) as PriceAction;
            setAction(picked);
            if (picked === 'discount') syncDiscountAmount(discountPercent, tariffBase);
          }}
        />
        {action === 'manual' ? (
          <Field
            label={t('manualDailyRate')}
            preset="amount"
            type="number"
            step="0.01"
            value={manualDailyRate}
            disabled={ratesLocked}
            onChange={(e) => onManualRate(e.target.value)}
          />
        ) : null}
        {action === 'discount' ? (
          <>
            <Field
              label={t('stayDiscountPct')}
              preset="amount"
              type="number"
              step="0.01"
              value={discountPercent}
              disabled={ratesLocked}
              onChange={(e) => {
                onDiscountPercent(e.target.value);
                syncDiscountAmount(e.target.value, tariffBase);
              }}
            />
            <Field
              label={t('priceDiscountAmount')}
              preset="amount"
              type="number"
              step="0.01"
              value={discountAmount}
              disabled={ratesLocked || tariffBase == null}
              onChange={(e) => {
                setDiscountAmount(e.target.value);
                const moneyOff = Number(e.target.value);
                if (tariffBase != null && tariffBase > 0 && moneyOff >= 0) {
                  onDiscountPercent(money((moneyOff / tariffBase) * 100));
                }
              }}
            />
          </>
        ) : null}
        {action === 'total' ? (
          <Field
            label={t('stayTotalAmount')}
            preset="amount"
            type="number"
            step="0.01"
            value={stayTotalDraft}
            disabled={ratesLocked}
            onChange={(e) => setStayTotalDraft(e.target.value)}
          />
        ) : null}
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={ratesLocked || busy || targets.length === 0}
          onClick={apply}
        >
          {t('priceApply')}
        </button>
        <p className="mb-1 ml-auto text-[12px] text-[#34495E]">
          {t('priceTariff')}: <span className="font-mono">{pairLabel(action === 'manual' ? (tariffNightly ?? commonTariff) : commonTariff)}</span>
          {' · '}
          {t('priceFinal')}: <span className="font-mono">{pairLabel(previewFinal)}</span>
        </p>
      </div>

      {dailyRates.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[#D5DADF]">
          <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed font-mono text-[12px]" data-testid="rate-grid-table">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[18%]" />
              <col className="w-[22%]" />
              <col className="w-[20%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead className="sticky top-0 bg-[#F8FAFC]">
              <tr>
                <th className="p-2 text-left">{t('stayDate')}</th>
                <th className="p-2 text-right">{t('priceTariff')}</th>
                <th className="p-2 text-right">{t('amount')}</th>
                <th className="p-2 text-right">{t('nightDiscountPct')}</th>
                <th className="p-2 text-center">{t('nightFixed')}</th>
              </tr>
            </thead>
            <tbody>
              {dailyRates.map((row, index) => {
                const kind = kindOf(row.stayDate);
                const locked = ratesLocked || kind === 'posted';
                const rowClass =
                  kind === 'posted'
                    ? 'border-t border-[#D5DADF] bg-[#F4F6F7] text-[#95A5A6]'
                    : kind === 'past'
                      ? 'border-t border-[#D5DADF] bg-[#FDF6E3]'
                      : 'border-t border-[#D5DADF]';
                return (
                  <tr key={row.stayDate} className={rowClass} data-night-kind={kind}>
                    <td className="p-2">{row.stayDate.slice(0, 10)}</td>
                    <td className="p-2 text-right">{money(nightTariff(row, tariffNightly))}</td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        className="w-24 rounded border border-[#D5DADF] bg-white px-1 py-0.5 text-right disabled:bg-transparent disabled:text-[#95A5A6]"
                        value={row.amount}
                        disabled={locked}
                        onChange={(e) => {
                          const next = [...dailyRates];
                          next[index] = {
                            ...row,
                            amount: Number(e.target.value),
                            manualFlag: true,
                            fixPrice: true,
                          };
                          onDailyRates(next);
                        }}
                      />
                    </td>
                    <td className="p-2 text-right">
                      {row.discountPct != null && Number(row.discountPct) > 0
                        ? `${Number(row.discountPct).toFixed(2)}%`
                        : '—'}
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(row.fixPrice)}
                        disabled={locked}
                        aria-label={t('nightFixed')}
                        onChange={(e) => {
                          const next = [...dailyRates];
                          next[index] = {
                            ...row,
                            fixPrice: e.target.checked,
                            manualFlag: e.target.checked,
                          };
                          onDailyRates(next);
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <table className="w-full table-fixed shrink-0 border-t border-[#D5DADF] font-mono" data-testid="pricing-stay-total">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[18%]" />
              <col className="w-[22%]" />
              <col className="w-[20%]" />
              <col className="w-[18%]" />
            </colgroup>
            <tbody>
              <tr>
                <td />
                <td />
                <td className="px-2 py-1 text-right text-[15px] font-semibold text-[#34495E]">
                  {money(stayTotal)}
                </td>
                <td className="px-2 py-1 text-[11px] text-[#7F8C8D]" colSpan={2}>
                  AZN
                </td>
              </tr>
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
        <div className={`${SUBSECTION_SURFACE_CLASS} shrink-0`} data-testid="package-compose-summary">
          <p className="m-0 mb-1 text-[12px] font-semibold text-[#34495E]">
            {t('packageComposeSummary')}: {packageCompose.total.toFixed(2)} AZN
          </p>
          <ul className="m-0 list-none space-y-0.5 p-0 text-[12px] text-[#34495E]">
            {packageCompose.lines.map((line, index) => (
              <li key={`${line.code ?? line.label ?? index}-${index}`} className="flex justify-between gap-2">
                <span>{line.label ?? line.code ?? '—'}</span>
                <span className="font-mono">{Number(line.amount).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
