'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  CatalogField,
  DATA_TABLE_SHELL_CLASS,
  DatePicker,
  Field,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  isoDateToDisplay,
  showApiError,
} from '@era/satellite-kit/ui';
import { bakuCivilUtcDate } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { columnLabel } from '@/lib/reports/column-labels';
import {
  REPORT_CATALOG,
  getPackDefaults,
  getReportBySlug,
  type ReportCategory,
  type ReportDateMode,
} from '@/lib/reports/catalog';
import { resolveDateMode, resolvePreset, type PeriodPreset } from '@/lib/reports/period';
import { isReportTotalRow, reportCellAlign } from '@/lib/reports/report-align';
import { reportToSheets, type TabularSheet } from '@/lib/reports/tabular';

const CATEGORIES: ReportCategory[] = ['daily', 'occupancy', 'financial', 'analysis', 'agency', 'booking'];

const CUBE_DIMS = ['date', 'department', 'agency', 'revenueCode', 'roomType'] as const;

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

function ymdOf(date: Date): string {
  return hotelDateKey(date);
}

function isYmd(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function ReportsWorkspace() {
  const tRoot = useTranslations();
  const t = useTranslations('reports');
  const tp = useTranslations('reportsPdf');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const requested = searchParams.get('report');
  const categoryHint = searchParams.get('category') as ReportCategory | null;
  const requestedKnown = requested && getReportBySlug(requested) ? requested : '';
  const unknownReport = Boolean(requested) && !requestedKnown;
  const initialSlug =
    requestedKnown ||
    (categoryHint ? REPORT_CATALOG.find((r) => r.category === categoryHint)?.slug : undefined) ||
    getPackDefaults()[0]?.slug ||
    REPORT_CATALOG[0].slug;

  const linkedFrom = isYmd(searchParams.get('from')) ? searchParams.get('from') : '';
  const linkedTo = isYmd(searchParams.get('to')) ? searchParams.get('to') : linkedFrom;

  const [slug, setSlug] = useState(unknownReport ? '' : initialSlug);
  const [search, setSearch] = useState('');
  const [businessDate, setBusinessDate] = useState('');
  const [preset, setPreset] = useState<PresetChoice>(linkedFrom ? 'customRange' : 'today');
  const [anchorIso, setAnchorIso] = useState(linkedFrom);
  const [customFrom, setCustomFrom] = useState(linkedFrom);
  const [customTo, setCustomTo] = useState(linkedTo);
  const [dim, setDim] = useState<string>('department');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);
  const [data, setData] = useState<unknown>(null);
  const [shown, setShown] = useState(false);
  const loadAbort = useRef<AbortController | null>(null);

  const def = getReportBySlug(slug);

  useEffect(() => {
    if (!requested) return;
    if (getReportBySlug(requested)) {
      if (requested !== slug) setSlug(requested);
      return;
    }
    if (slug) setSlug('');
  }, [requested, slug]);

  useEffect(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (!isYmd(from)) return;
    setAnchorIso(from);
    setCustomFrom(from);
    setCustomTo(isYmd(to) ? to : from);
    setPreset('customRange');
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/business-date')
      .then((r) => r.json())
      .then((body) => {
        const raw = body.currentBusinessDate ?? body.businessDate ?? body.date ?? hotelDateKey();
        const ymd = typeof raw === 'string' ? raw.slice(0, 10) : hotelDateKey();
        setBusinessDate(ymd);
        setAnchorIso((prev) => prev || ymd);
        setCustomFrom((prev) => prev || ymd);
        setCustomTo((prev) => prev || ymd);
      })
      .catch(() => {
        const ymd = hotelDateKey();
        setBusinessDate((prev) => prev || ymd);
        setAnchorIso((prev) => prev || ymd);
        setCustomFrom((prev) => prev || ymd);
        setCustomTo((prev) => prev || ymd);
      });
  }, []);

  function periodFor(dateMode: ReportDateMode): { from: string; to: string } | null {
    if (!businessDate) return null;
    const businessDay = bakuCivilUtcDate(businessDate);
    if (dateMode === 'month_to_closed' || dateMode === 'year_to_closed') {
      const anchor = anchorIso || businessDate;
      const resolved = resolveDateMode(dateMode, bakuCivilUtcDate(anchor));
      return { from: ymdOf(resolved.from), to: ymdOf(resolved.to) };
    }
    if (dateMode === 'business_date') {
      const anchor = anchorIso || businessDate;
      if (preset === 'customRange') return { from: anchor, to: anchor };
      const resolved = resolvePreset(PRESET_TO_RESOLVE[preset], bakuCivilUtcDate(anchor));
      return { from: ymdOf(resolved.from), to: ymdOf(resolved.to) };
    }
    if (preset === 'customRange') {
      return { from: customFrom || businessDate, to: customTo || businessDate };
    }
    const resolved = resolvePreset(PRESET_TO_RESOLVE[preset], businessDay);
    return { from: ymdOf(resolved.from), to: ymdOf(resolved.to) };
  }

  const period = def ? periodFor(def.dateMode) : null;

  const presetsLocked = def?.dateMode === 'month_to_closed' || def?.dateMode === 'year_to_closed';
  const isCube = Boolean(slug.endsWith('-cube'));

  const presetOptions = [
    { value: 'today', label: t('periodPresetToday') },
    { value: 'yesterday', label: t('periodPresetYesterday') },
    { value: 'thisWeek', label: t('periodPresetThisWeek') },
    { value: 'thisMonth', label: t('periodPresetThisMonth') },
    { value: 'lastMonth', label: t('periodPresetLastMonth') },
    { value: 'thisYear', label: t('periodPresetThisYear') },
    { value: 'lastYear', label: t('periodPresetLastYear') },
    { value: 'customRange', label: t('periodPresetCustomRange') },
  ];

  const needle = search.trim().toLowerCase();
  const visible = REPORT_CATALOG.filter((report) => {
    if (!needle) return true;
    const title = tRoot(report.titleKey as 'reportsPdf.dailyManagement').toLowerCase();
    return title.includes(needle) || report.slug.includes(needle);
  });

  function abortLoad() {
    loadAbort.current?.abort();
    loadAbort.current = null;
    setLoading(false);
  }

  function openReport(next: string) {
    abortLoad();
    setSlug(next);
    setData(null);
    setShown(false);
    if (next.endsWith('-cube') && next.includes('reservation')) setDim('roomType');
    else if (next.endsWith('-cube') && next.includes('agency')) setDim('agency');
    else if (next.endsWith('-cube')) setDim('department');
    router.replace(`/reports?report=${encodeURIComponent(next)}`, { scroll: false });
  }

  function queryString(): string | null {
    if (!period) return null;
    const qs = new URLSearchParams({ from: period.from, to: period.to, lang: locale });
    if (isCube) qs.set('dim', dim);
    return qs.toString();
  }

  async function showReport() {
    const qs = queryString();
    if (!qs) return;
    abortLoad();
    const controller = new AbortController();
    loadAbort.current = controller;
    setLoading(true);
    setShown(true);
    setData(null);
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(slug)}?${qs}`, { signal: controller.signal });
      const body = await res.json().catch(() => ({ error: res.statusText }));
      if (!res.ok) {
        setData(null);
        showApiError(body, t('exportFailed'));
        return;
      }
      setData(body);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setData(null);
      showApiError({ error: err instanceof Error ? err.message : t('exportFailed') });
    } finally {
      if (loadAbort.current === controller) {
        loadAbort.current = null;
        setLoading(false);
      }
    }
  }

  async function download(kind: 'pdf' | 'xlsx') {
    const qs = queryString();
    if (!qs) return;
    setExporting(kind);
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(slug)}/${kind}?${qs}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        showApiError(body, t('exportFailed'));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}_${period?.from ?? 'report'}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showApiError({ error: err instanceof Error ? err.message : t('exportFailed') });
    } finally {
      setExporting(null);
    }
  }

  const sheets = shown && data != null ? reportToSheets(data).filter((sheet) => sheet.columns.length > 0) : [];

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-[32rem] gap-4">
      <aside className="flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-[#D5DADF] bg-white">
        <div className="border-b border-[#D5DADF] p-3">
          <Field
            label={t('search')}
            preset="longText"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('search')}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {CATEGORIES.map((category) => {
            const items = visible.filter((report) => report.category === category);
            if (items.length === 0) return null;
            return (
              <div key={category} className="mb-3">
                <p className="px-2 py-1.5 text-sm font-semibold text-[#34495E]">
                  {t(category)}
                </p>
                {items.map((report) => {
                  const active = report.slug === slug;
                  return (
                    <button
                      key={report.slug}
                      type="button"
                      onClick={() => openReport(report.slug)}
                      className={`mb-0.5 block w-full truncate rounded-lg px-2 py-1.5 text-left text-[13px] ${
                        active ? 'bg-[#EBF5FB] font-medium text-[#2980B9]' : 'text-[#34495E] hover:bg-[#F8F9FA]'
                      }`}
                    >
                      {tRoot(report.titleKey as 'reportsPdf.dailyManagement')}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
        <div>
          <h1 className="text-xl font-semibold text-[#34495E]">
            {def ? tRoot(def.titleKey as 'reportsPdf.dailyManagement') : t('pickReport')}
          </h1>
        </div>

        <div className="rounded-xl border border-[#D5DADF] bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={!period || exporting != null} onClick={() => void download('pdf')}>
                {exporting === 'pdf' ? tc('loading') : t('exportPdf')}
              </button>
              <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={!period || exporting != null} onClick={() => void download('xlsx')}>
                {exporting === 'xlsx' ? tc('loading') : t('exportExcel')}
              </button>
            </div>
            <div className="flex flex-wrap items-end justify-end gap-2">
            <div className="w-44">
              <CatalogField
                kind="CLOSED_MEDIUM"
                label={tp('period')}
                value={preset}
                disabled={presetsLocked}
                emptyLabel={null}
                widthPreset="select"
                options={presetOptions}
                onChange={(value) => {
                  const next = (Array.isArray(value) ? value[0] : value) as PresetChoice;
                  if (!next) return;
                  abortLoad();
                  setPreset(next);
                }}
              />
            </div>
            {def?.dateMode === 'business_date' ? (
              <DatePicker
                label={t('selectDate')}
                value={anchorIso || businessDate}
                onChange={(iso) => {
                  if (!iso) return;
                  abortLoad();
                  setAnchorIso(iso);
                }}
                placeholder={tc('datePlaceholder')}
                openCalendarLabel={tc('openCalendar')}
              />
            ) : null}
            {def?.dateMode === 'range' && preset === 'customRange' ? (
              <>
                <DatePicker
                  label={t('dateFrom')}
                  value={customFrom || businessDate}
                  onChange={(iso) => {
                    if (!iso) return;
                    abortLoad();
                    setCustomFrom(iso);
                  }}
                  placeholder={tc('datePlaceholder')}
                  openCalendarLabel={tc('openCalendar')}
                />
                <DatePicker
                  label={t('dateTo')}
                  value={customTo || businessDate}
                  onChange={(iso) => {
                    if (!iso) return;
                    abortLoad();
                    setCustomTo(iso);
                  }}
                  placeholder={tc('datePlaceholder')}
                  openCalendarLabel={tc('openCalendar')}
                />
              </>
            ) : null}
            {presetsLocked && period ? (
              <p className="pb-2 text-sm text-[#34495E]">
                {t('dateFrom')}: {isoDateToDisplay(period.from)} · {t('dateTo')}: {isoDateToDisplay(period.to)}
              </p>
            ) : null}
            {isCube ? (
              <div className="min-w-[12rem]">
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={t('cubeDimension')}
                  value={dim}
                  emptyLabel={null}
                  options={CUBE_DIMS.map((id) => ({ value: id, label: columnLabel(locale, id) }))}
                  onChange={(value) => {
                    const next = Array.isArray(value) ? value[0] : value;
                    if (next) setDim(next);
                  }}
                />
              </div>
            ) : null}
              <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={!period || loading} onClick={() => void showReport()}>
                {loading ? tc('loading') : t('show')}
              </button>
            </div>
          </div>
          {period && def && !presetsLocked && def.dateMode !== 'business_date' && preset !== 'customRange' ? (
            <p className="mt-2 text-sm text-[#7F8C8D]">
              {isoDateToDisplay(period.from)} — {isoDateToDisplay(period.to)}
            </p>
          ) : null}
        </div>

        {loading ? <p className="text-sm text-[#7F8C8D]">{t('calculating')}</p> : null}
        {!unknownReport && !shown ? <p className="text-sm text-[#7F8C8D]">{t('pressShow')}</p> : null}
        {unknownReport ? <p className="text-sm text-[#C0392B]">{t('unknownReport', { slug: requested ?? '' })}</p> : null}
        {shown && !loading && sheets.length === 0 ? <p className="text-sm text-[#7F8C8D]">{tp('noData')}</p> : null}
        {sheets.map((sheet) => (
          <ReportSheet key={sheet.name} sheet={sheet} locale={locale} />
        ))}
      </section>
    </div>
  );
}

export function ReportSheet({ sheet, locale }: { sheet: TabularSheet; locale: string }) {
  return (
    <div className={DATA_TABLE_SHELL_CLASS}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-[#D5DADF] bg-[#F8F9FA]">
            <tr>
              {sheet.columns.map((key) => (
                <th key={key} className="px-3 py-2 text-center text-sm font-bold text-[#34495E]">
                  {columnLabel(locale, key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-[#7F8C8D]" colSpan={Math.max(sheet.columns.length, 1)}>
                  —
                </td>
              </tr>
            ) : (
              sheet.rows.map((row, index) => (
                <tr key={index} className={`${index % 2 === 1 ? 'bg-[#F8F9FA]' : ''} ${isReportTotalRow(row) ? 'font-bold' : ''}`}>
                  {row.map((value, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`px-3 py-1.5 text-[#34495E] ${
                        reportCellAlign(value) === 'right'
                          ? 'text-right'
                          : reportCellAlign(value) === 'center'
                            ? 'text-center'
                            : 'text-left'
                      }`}
                    >
                      {value == null
                        ? ''
                        : typeof value === 'number'
                          ? new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(value)
                          : value}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
