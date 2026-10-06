'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  CatalogField,
  DatePicker,
  Field,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { columnLabel } from '@/lib/reports/column-labels';
import { REPORT_CATALOG, getPackDefaults, getReportBySlug, type ReportCategory } from '@/lib/reports/catalog';
import {
  DATE_BAR_PRESETS,
  closedBusinessDay,
  defaultPeriod,
  editPeriod,
  opensWithoutPreset,
  presetPeriod,
  type DateBarPeriod,
} from '@/lib/reports/date-bar';
import type { ReportLayout } from '@/lib/reports/layout';
import { reportFileName } from '@/lib/reports/locale';
import type { PeriodPreset } from '@/lib/reports/period';
import { ReportLayoutView } from '@/components/reports/ReportLayoutView';

const CATEGORIES: ReportCategory[] = ['daily', 'occupancy', 'financial', 'analysis', 'agency', 'booking'];

const CUBE_DIMS = ['date', 'department', 'agency', 'revenueCode', 'roomType'] as const;

const PRESET_LABEL_KEY: Record<PeriodPreset, string> = {
  default: 'periodPresetDefault',
  today: 'periodPresetToday',
  yesterday: 'periodPresetYesterday',
  tomorrow: 'periodPresetTomorrow',
  thisWeek: 'periodPresetThisWeek',
  thisMonth: 'periodPresetThisMonth',
  lastMonth: 'periodPresetLastMonth',
  thisYear: 'periodPresetThisYear',
  lastYear: 'periodPresetLastYear',
};

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
  const [businessDay, setBusinessDay] = useState('');
  const [closedDay, setClosedDay] = useState('');
  const [period, setPeriod] = useState<DateBarPeriod | null>(
    linkedFrom ? { from: linkedFrom, to: linkedTo || linkedFrom } : null,
  );
  const [preset, setPreset] = useState<PeriodPreset | ''>(linkedFrom ? '' : 'default');
  const [dim, setDim] = useState<string>('department');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);
  const [layout, setLayout] = useState<ReportLayout | null>(null);
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
    setPeriod({ from, to: isYmd(to) ? to : from });
    setPreset('');
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/business-date')
      .then((r) => r.json())
      .then((body: { currentBusinessDate?: string; businessDayStatus?: string | null }) => {
        const raw = body.currentBusinessDate ?? hotelDateKey();
        const ymd = typeof raw === 'string' ? raw.slice(0, 10) : hotelDateKey();
        setBusinessDay(ymd);
        setClosedDay(closedBusinessDay(ymd, body.businessDayStatus));
      })
      .catch(() => {
        const ymd = hotelDateKey();
        setBusinessDay((prev) => prev || ymd);
        setClosedDay((prev) => prev || closedBusinessDay(ymd, null));
      });
  }, []);

  useEffect(() => {
    if (!def || !businessDay || !closedDay || period) return;
    setPeriod(defaultPeriod(def.dateMode, businessDay, closedDay));
    setPreset(opensWithoutPreset(def.dateMode) ? '' : 'default');
  }, [def, businessDay, closedDay, period]);

  const isCube = Boolean(slug.endsWith('-cube'));

  const presetOptions = DATE_BAR_PRESETS.map((p) => ({ value: p, label: t(PRESET_LABEL_KEY[p] as 'periodPresetToday') }));

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
    setLayout(null);
    setShown(false);
    const nextDef = getReportBySlug(next);
    if (nextDef && businessDay && closedDay) {
      if (opensWithoutPreset(nextDef.dateMode)) {
        setPeriod(defaultPeriod(nextDef.dateMode, businessDay, closedDay));
        setPreset('');
      } else if (preset) {
        setPeriod(presetPeriod(preset, nextDef.dateMode, businessDay, closedDay));
      }
    }
    if (next.endsWith('-cube') && next.includes('reservation')) setDim('roomType');
    else if (next.endsWith('-cube') && next.includes('agency')) setDim('agency');
    else if (next.endsWith('-cube')) setDim('department');
    router.replace(`/reports?report=${encodeURIComponent(next)}`, { scroll: false });
  }

  function choosePreset(next: PeriodPreset) {
    if (!def || !businessDay || !closedDay) return;
    abortLoad();
    setPreset(next);
    setPeriod(presetPeriod(next, def.dateMode, businessDay, closedDay));
  }

  function editDate(field: 'from' | 'to', iso: string) {
    abortLoad();
    setPreset('');
    setPeriod((prev) => editPeriod(prev ?? { from: iso, to: iso }, field, iso));
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
    setLayout(null);
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(slug)}/layout?${qs}`, { signal: controller.signal });
      const body = await res.json().catch(() => ({ error: res.statusText }));
      if (!res.ok) {
        showApiError(body, t('exportFailed'));
        return;
      }
      setLayout((body as { layout?: ReportLayout }).layout ?? null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
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
      a.download = reportFileName(slug, locale, period?.from ?? 'report', kind === 'pdf' ? 'pdf' : 'xlsx');
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showApiError({ error: err instanceof Error ? err.message : t('exportFailed') });
    } finally {
      setExporting(null);
    }
  }

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

      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="shrink-0">
          <h1 className="text-xl font-semibold text-[#34495E]">
            {def ? tRoot(def.titleKey as 'reportsPdf.dailyManagement') : t('pickReport')}
          </h1>
        </div>

        <div className="shrink-0 space-y-3 rounded-xl border border-[#D5DADF] bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap items-end gap-2">
              <DatePicker
                label={t('dateStart')}
                value={period?.from ?? ''}
                onChange={(iso) => iso && editDate('from', iso)}
                placeholder={tc('datePlaceholder')}
                openCalendarLabel={tc('openCalendar')}
              />
              <DatePicker
                label={t('dateEnd')}
                value={period?.to ?? ''}
                onChange={(iso) => iso && editDate('to', iso)}
                placeholder={tc('datePlaceholder')}
                openCalendarLabel={tc('openCalendar')}
              />
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
            </div>
            <div className="flex flex-wrap items-end justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={!period || exporting != null} onClick={() => void download('pdf')}>
                {exporting === 'pdf' ? tc('loading') : t('exportPdf')}
              </button>
              <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={!period || exporting != null} onClick={() => void download('xlsx')}>
                {exporting === 'xlsx' ? tc('loading') : t('exportExcel')}
              </button>
              <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={!period || loading} onClick={() => void showReport()}>
                {loading ? tc('loading') : t('show')}
              </button>
            </div>
          </div>
          <CatalogField
            kind="CLOSED_SMALL"
            preferChips
            label={tp('period')}
            value={preset}
            emptyLabel={null}
            disabled={!def || !businessDay}
            options={presetOptions}
            onChange={(value) => {
              const next = (Array.isArray(value) ? value[0] : value) as PeriodPreset;
              if (next) choosePreset(next);
            }}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? <p className="text-sm text-[#7F8C8D]">{t('calculating')}</p> : null}
          {!unknownReport && !shown ? <p className="text-sm text-[#7F8C8D]">{t('pressShow')}</p> : null}
          {unknownReport ? <p className="text-sm text-[#C0392B]">{t('unknownReport', { slug: requested ?? '' })}</p> : null}
          {shown && !loading && layout ? <ReportLayoutView layout={layout} locale={locale} noDataLabel={tp('noData')} /> : null}
          {shown && !loading && !layout ? <p className="text-sm text-[#7F8C8D]">{tp('noData')}</p> : null}
        </div>
      </section>
    </div>
  );
}
