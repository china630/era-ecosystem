'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DatePicker, isoDateToDisplay, SECONDARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import { resolveDateMode, resolvePreset, type PeriodPreset } from '@/lib/reports/period';

type ReportDateMode = 'business_date' | 'month_to_closed' | 'year_to_closed' | 'range';

interface ReportFilterBarProps {
  slug: string;
  dateMode: ReportDateMode;
  businessDate: string;
  onChange: (filters: { from: string; to: string }) => void;
  onExportPdf?: () => void;
}

type PresetChoice = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'customRange';

const PRESET_TO_RESOLVE: Record<Exclude<PresetChoice, 'customRange'>, PeriodPreset> = {
  today: 'today',
  yesterday: 'yesterday',
  thisWeek: 'thisWeek',
  thisMonth: 'thisMonth',
  lastMonth: 'lastMonth',
  thisYear: 'thisYear',
  lastYear: 'lastYear',
};

function isoToLocalDate(iso: string): Date {
  // Treat iso date as local date to avoid tz shifting.
  return new Date(`${iso}T00:00:00`);
}

function localDateToIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function ReportFilterBar({
  slug,
  dateMode,
  businessDate,
  onChange,
  onExportPdf,
}: ReportFilterBarProps) {
  const locale = useLocale();
  const t = useTranslations('reports');
  const tc = useTranslations('common');

  const businessDay = useMemo(() => isoToLocalDate(businessDate), [businessDate]);

  const initialPreset: PresetChoice =
    dateMode === 'month_to_closed' ? 'thisMonth' : dateMode === 'year_to_closed' ? 'thisYear' : 'today';

  const [preset, setPreset] = useState<PresetChoice>(initialPreset);
  const [anchorIso, setAnchorIso] = useState<string>(businessDate);
  const [fromIso, setFromIso] = useState<string>(() => localDateToIsoDate(resolveDateMode(dateMode, businessDay).from));
  const [toIso, setToIso] = useState<string>(() => localDateToIsoDate(resolveDateMode(dateMode, businessDay).to));

  useEffect(() => {
    setPreset(initialPreset);
    setAnchorIso(businessDate);
    const resolved = resolveDateMode(dateMode, businessDay);
    setFromIso(localDateToIsoDate(resolved.from));
    setToIso(localDateToIsoDate(resolved.to));
  }, [businessDate, businessDay, dateMode, initialPreset]);

  useEffect(() => {
    if (!fromIso || !toIso) return;
    onChange({ from: fromIso, to: toIso });
  }, [fromIso, onChange, toIso]);

  useEffect(() => {
    if (dateMode !== 'business_date') return;
    const ref = isoToLocalDate(anchorIso);
    if (preset === 'customRange') {
      setFromIso(anchorIso);
      setToIso(anchorIso);
      return;
    }

    const resolved = resolvePreset(PRESET_TO_RESOLVE[preset as Exclude<PresetChoice, 'customRange'>], ref);
    setFromIso(localDateToIsoDate(resolved.from));
    setToIso(localDateToIsoDate(resolved.to));
  }, [anchorIso, dateMode, preset]);

  useEffect(() => {
    if (dateMode !== 'range') return;
    if (preset === 'customRange') return;

    const resolved = resolvePreset(PRESET_TO_RESOLVE[preset as Exclude<PresetChoice, 'customRange'>], businessDay);
    setFromIso(localDateToIsoDate(resolved.from));
    setToIso(localDateToIsoDate(resolved.to));
  }, [businessDay, dateMode, preset]);

  const presetsDisabled = dateMode === 'month_to_closed' || dateMode === 'year_to_closed';

  const presetOptions: Array<{ id: PresetChoice; label: string }> = [
    { id: 'today', label: t('periodPresetToday') },
    { id: 'yesterday', label: t('periodPresetYesterday') },
    { id: 'thisWeek', label: t('periodPresetThisWeek') },
    { id: 'thisMonth', label: t('periodPresetThisMonth') },
    { id: 'lastMonth', label: t('periodPresetLastMonth') },
    { id: 'thisYear', label: t('periodPresetThisYear') },
    { id: 'lastYear', label: t('periodPresetLastYear') },
    { id: 'customRange', label: t('periodPresetCustomRange') },
  ];

  function onExport() {
    if (!fromIso || !toIso) return;
    onExportPdf?.();
    const qs = new URLSearchParams({
      from: fromIso,
      to: toIso,
      locale,
    });
    const url = `/api/reports/${encodeURIComponent(slug)}/pdf?${qs.toString()}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const showCustomPickers = dateMode === 'range' && preset === 'customRange';

  const readOnlyPeriod = useMemo(() => {
    if (dateMode !== 'month_to_closed' && dateMode !== 'year_to_closed') return null;
    const resolved = resolveDateMode(dateMode, businessDay);
    return {
      from: localDateToIsoDate(resolved.from),
      to: localDateToIsoDate(resolved.to),
    };
  }, [businessDay, dateMode]);

  return (
    <div className="flex w-full flex-col gap-4 rounded-md border border-gray-200 bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {presetOptions.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm text-[#34495E]">
              <input
                type="radio"
                name={`report-period-${dateMode}`}
                value={p.id}
                checked={preset === p.id}
                disabled={presetsDisabled}
                onChange={() => setPreset(p.id)}
              />
              <span className={presetsDisabled ? 'text-gray-400' : undefined}>{p.label}</span>
            </label>
          ))}
        </div>

        {dateMode === 'business_date' ? (
          <DatePicker
            label={t('selectDate')}
            value={anchorIso}
            onChange={(iso) => iso && setAnchorIso(iso)}
            placeholder={tc('datePlaceholder')}
            openCalendarLabel={tc('openCalendar')}
          />
        ) : null}

        {dateMode === 'range' ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <DatePicker
              label={t('dateFrom')}
              value={fromIso}
              onChange={(iso) => iso && setFromIso(iso)}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
              disabled={!showCustomPickers}
              fluid
            />
            <DatePicker
              label={t('dateTo')}
              value={toIso}
              onChange={(iso) => iso && setToIso(iso)}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
              disabled={!showCustomPickers}
              fluid
            />
          </div>
        ) : null}

        {readOnlyPeriod ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#34495E]">
            <span>
              {t('dateFrom')}: {isoDateToDisplay(readOnlyPeriod.from)}
            </span>
            <span>
              {t('dateTo')}: {isoDateToDisplay(readOnlyPeriod.to)}
            </span>
          </div>
        ) : null}
      </div>

      <button type="button" className={`${SECONDARY_BUTTON_CLASS} whitespace-nowrap`} onClick={onExport}>
        {t('exportPdf')}
      </button>
    </div>
  );
}

export default ReportFilterBar;

