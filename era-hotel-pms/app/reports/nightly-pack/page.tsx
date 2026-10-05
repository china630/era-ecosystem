'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DatePicker, SECONDARY_BUTTON_CLASS, showApiError } from '@era/satellite-kit/ui';
import { bakuCivilUtcDate } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { getPackDefaults } from '@/lib/reports/catalog';
import { resolveDateMode } from '@/lib/reports/period';
import type { ReportLayout } from '@/lib/reports/layout';
import { ReportLayoutView } from '@/components/reports/ReportLayoutView';

interface PackBlock {
  slug: string;
  title: string;
  layout: ReportLayout | null;
  error?: string;
}

function previousBusinessDate(iso: string): string {
  const day = bakuCivilUtcDate(iso);
  day.setUTCDate(day.getUTCDate() - 1);
  return hotelDateKey(day);
}

export default function NightlyPackPage() {
  const t = useTranslations('reports');
  const tRoot = useTranslations();
  const tc = useTranslations('common');
  const locale = useLocale();
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [blocks, setBlocks] = useState<PackBlock[]>([]);
  const loadAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch('/api/business-date');
      const body = (await res.json().catch(() => null)) as {
        currentBusinessDate?: string;
        businessDayStatus?: string | null;
      } | null;
      if (cancelled || !body?.currentBusinessDate) return;
      const closed =
        body.businessDayStatus === 'CLOSED' ? body.currentBusinessDate : previousBusinessDate(body.currentBusinessDate);
      setDate(closed);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!date) return;
    loadAbort.current?.abort();
    const controller = new AbortController();
    loadAbort.current = controller;
    setLoading(true);
    setBlocks([]);

    const anchor = bakuCivilUtcDate(date);
    void (async () => {
      const next: PackBlock[] = [];
      await Promise.all(
        getPackDefaults().map(async (report, index) => {
          const range = resolveDateMode(report.dateMode, anchor);
          const qs = new URLSearchParams({
            from: hotelDateKey(range.from),
            to: hotelDateKey(range.to),
            lang: locale,
          });
          try {
            const res = await fetch(`/api/reports/${encodeURIComponent(report.slug)}/layout?${qs}`, {
              signal: controller.signal,
            });
            const body = await res.json().catch(() => ({ error: res.statusText }));
            if (!res.ok) {
              next[index] = {
                slug: report.slug,
                title: tRoot(report.titleKey as 'reportsPdf.dailyManagement'),
                layout: null,
                error: typeof body.error === 'string' ? body.error : t('exportFailed'),
              };
              return;
            }
            next[index] = {
              slug: report.slug,
              title: tRoot(report.titleKey as 'reportsPdf.dailyManagement'),
              layout: (body as { layout?: ReportLayout }).layout ?? null,
            };
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            next[index] = {
              slug: report.slug,
              title: tRoot(report.titleKey as 'reportsPdf.dailyManagement'),
              layout: null,
              error: err instanceof Error ? err.message : t('exportFailed'),
            };
          }
        }),
      );
      if (controller.signal.aborted) return;
      setBlocks(next.filter(Boolean));
      setLoading(false);
    })();

    return () => controller.abort();
  }, [date, locale, t, tRoot]);

  async function downloadZip() {
    if (!date) return;
    setDownloading(true);
    try {
      const qs = new URLSearchParams({ businessDate: date, lang: locale });
      const res = await fetch(`/api/reports/pack/download?${qs}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        showApiError(body, t('exportFailed'));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `morning-pack-${date}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <h1 className="text-xl font-semibold text-[#34495E]">{t('morningPack')}</h1>
      <div className="rounded-xl border border-[#D5DADF] bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={!date || downloading}
            onClick={() => void downloadZip()}
          >
            {downloading ? tc('loading') : t('downloadZip')}
          </button>
          <DatePicker
            label={t('selectDate')}
            value={date}
            onChange={(iso) => iso && setDate(iso)}
            placeholder={tc('datePlaceholder')}
            openCalendarLabel={tc('openCalendar')}
          />
        </div>
      </div>
      {loading ? <p className="text-sm text-[#7F8C8D]">{t('calculating')}</p> : null}
      {blocks.map((block) => (
        <div key={block.slug} className="space-y-2">
          <h2 className="text-base font-semibold text-[#34495E]">{block.title}</h2>
          {block.error ? <p className="text-sm text-[#C0392B]">{block.error}</p> : null}
          {!block.error && !block.layout ? <p className="text-sm text-[#7F8C8D]">{tRoot('reportsPdf.noData')}</p> : null}
          {block.layout ? (
            <ReportLayoutView layout={block.layout} locale={locale} noDataLabel={tRoot('reportsPdf.noData')} />
          ) : null}
        </div>
      ))}
    </div>
  );
}
