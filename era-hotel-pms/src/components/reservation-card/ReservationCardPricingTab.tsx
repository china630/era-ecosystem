'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  Field,
  MODAL_CHECKBOX_CLASS,
  MODAL_INPUT_CLASS,
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

type PriceAction = 'manual' | 'discount' | 'total' | 'restore';
type NightKind = 'open' | 'posted' | 'past';

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function tariffOf(row: DailyRateRow): number {
  if (row.tariffAmount != null && Number.isFinite(row.tariffAmount)) return row.tariffAmount;
  const pct = Number(row.discountPct ?? 0);
  if (pct > 0 && pct < 100) return Math.round((row.amount / (1 - pct / 100)) * 100) / 100;
  return row.amount;
}

/** Night sell of the selected package. A plan price is only the fallback when no package is composed. */
function packageNightBase(
  compose: PackageComposeSummary | null | undefined,
  planNightly: number | null,
): number | null {
  if (compose != null && compose.total > 0) return compose.total;
  if (planNightly != null && planNightly > 0) return planNightly;
  return null;
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
  onPostNight,
  onPostMissed,
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
  onPostNight?: (ymd: string) => void;
  onPostMissed?: () => void;
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
  const tariffTotal = useMemo(
    () => dailyRates.reduce((sum, row) => sum + tariffOf(row), 0),
    [dailyRates],
  );

  const openNights = dailyRates.filter((row) => kindOf(row.stayDate) === 'open');
  const targets = openNights.filter((row) => !row.fixPrice);
  const packageBase = packageNightBase(packageCompose, tariffNightly);

  const percent = Number(discountPercent);

  function syncDiscountAmount(nextPercent: string, base: number | null) {
    const pct = Number(nextPercent);
    if (base == null || !(pct >= 0)) {
      setDiscountAmount('');
      return;
    }
    setDiscountAmount(money((base * pct) / 100));
  }

  const applyCount = action === 'restore' ? openNights.length : targets.length;

  function apply() {
    if (ratesLocked) return;
    if (action === 'restore') {
      if (packageBase == null || openNights.length === 0) return;
      const nightly = Math.round(packageBase * 100) / 100;
      onUseManual(false);
      onDiscountPercent('');
      onDailyRates(
        dailyRates.map((row) =>
          kindOf(row.stayDate) === 'open'
            ? {
                ...row,
                amount: nightly,
                tariffAmount: nightly,
                discountPct: null,
                manualFlag: false,
                fixPrice: false,
              }
            : row,
        ),
      );
      return;
    }
    if (targets.length === 0) return;
    if (action === 'manual') {
      const nightly = Number(manualDailyRate);
      if (!(nightly > 0)) return;
      onUseManual(true);
      onDailyRates(
        dailyRates.map((row) =>
          kindOf(row.stayDate) === 'open' && !row.fixPrice
            ? {
                ...row,
                tariffAmount: row.tariffAmount ?? row.amount,
                amount: nightly,
                manualFlag: true,
                fixPrice: true,
                discountPct: null,
              }
            : row,
        ),
      );
      return;
    }
    if (action === 'discount') {
      if (!(percent >= 0) || percent > 100 || packageBase == null) return;
      onUseManual(false);
      onDailyRates(
        dailyRates.map((row) => {
          if (kindOf(row.stayDate) !== 'open' || row.fixPrice) return row;
          const amount = Math.round(packageBase * (1 - percent / 100) * 100) / 100;
          return {
            ...row,
            tariffAmount: row.tariffAmount ?? packageBase,
            amount,
            discountPct: percent,
            manualFlag: false,
          };
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
        return {
          ...row,
          tariffAmount: row.tariffAmount ?? row.amount,
          amount,
          manualFlag: true,
          fixPrice: true,
          discountPct: null,
        };
      }),
    );
    if (parts[0] != null) onManualRate(money(parts[0]));
  }

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
            { value: 'restore', label: t('priceActionRestore') },
          ]}
          onChange={(next) => {
            const picked = (typeof next === 'string' ? next : next[0]) as PriceAction;
            setAction(picked);
            if (picked === 'discount') syncDiscountAmount(discountPercent, packageBase);
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
                syncDiscountAmount(e.target.value, packageBase);
              }}
            />
            <Field
              label={t('priceDiscountAmount')}
              preset="amount"
              type="number"
              step="0.01"
              value={discountAmount}
              disabled={ratesLocked || packageBase == null}
              onChange={(e) => {
                setDiscountAmount(e.target.value);
                const moneyOff = Number(e.target.value);
                if (packageBase != null && packageBase > 0 && moneyOff >= 0) {
                  onDiscountPercent(money((moneyOff / packageBase) * 100));
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
          disabled={
            ratesLocked ||
            busy ||
            applyCount === 0 ||
            (action === 'restore' && packageBase == null)
          }
          onClick={apply}
        >
          {t('priceApply')}
        </button>
      </div>

      {dailyRates.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[#D5DADF]">
          {onPostMissed && dailyRates.filter((row) => kindOf(row.stayDate) === 'past').length > 1 ? (
            <div className="flex justify-end border-b border-[#D5DADF] px-2 py-1">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy || isLocked}
                onClick={onPostMissed}
              >
                {t('missedNights')}
              </button>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed font-mono text-[12px]" data-testid="rate-grid-table">
            <colgroup>
              <col className="w-[6%]" />
              <col className="w-[20%]" />
              <col className="w-[18%]" />
              <col className="w-[20%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead className="sticky top-0 bg-[#F8FAFC]">
              <tr>
                <th className="px-2 py-1.5 text-right">{t('folioRowNo')}</th>
                <th className="px-2 py-1.5 text-left">{t('stayDate')}</th>
                <th className="px-2 py-1.5 text-right">{t('tariffPrice')}</th>
                <th className="px-2 py-1.5 text-right">{t('actualPrice')}</th>
                <th className="px-2 py-1.5 text-right">{t('nightDiscountPct')}</th>
                <th className="px-2 py-1.5 text-center">{t('nightFixed')}</th>
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
                    <td className="px-2 py-1.5 text-right text-[#95A5A6]">{index + 1}</td>
                    <td className="px-2 py-1.5">
                      <span>{row.stayDate.slice(0, 10)}</span>
                      {onPostNight && kind !== 'posted' && !isCreate && (!businessDate || row.stayDate.slice(0, 10) <= businessDate) ? (
                        <button
                          type="button"
                          className="ml-2 text-[11px] text-[#2980B9] hover:underline disabled:opacity-40"
                          disabled={busy || isLocked}
                          onClick={() => onPostNight(row.stayDate.slice(0, 10))}
                        >
                          {t('postNight')}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 text-right text-[#7F8C8D]">{money(tariffOf(row))}</td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        className={`w-24 ${MODAL_INPUT_CLASS} text-right disabled:bg-transparent disabled:text-[#95A5A6]`}
                        value={row.amount}
                        disabled={locked}
                        onChange={(e) => {
                          const next = [...dailyRates];
                          next[index] = {
                            ...row,
                            tariffAmount: row.tariffAmount ?? row.amount,
                            amount: Number(e.target.value),
                            manualFlag: true,
                            fixPrice: true,
                            discountPct: null,
                          };
                          onDailyRates(next);
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {row.discountPct != null && Number(row.discountPct) > 0
                        ? `${Number(row.discountPct).toFixed(2)}%`
                        : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        className={MODAL_CHECKBOX_CLASS}
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
              <col className="w-[6%]" />
              <col className="w-[20%]" />
              <col className="w-[18%]" />
              <col className="w-[20%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
            </colgroup>
            <tbody>
              <tr>
                <td />
                <td />
                <td className="px-2 py-1.5 text-right text-[14px] font-medium text-[#95A5A6]">
                  {money(tariffTotal)}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right text-[18px] font-semibold text-[#34495E]">
                  {t('stayGrandTotal')}: {money(stayTotal)} AZN
                </td>
                <td />
                <td />
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
    </div>
  );
}
