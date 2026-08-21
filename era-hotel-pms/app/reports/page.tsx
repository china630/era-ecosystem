import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { REPORT_CATALOG, type ReportCategory } from '@/lib/reports/catalog';

const REPORT_CATEGORIES: Array<{
  id: ReportCategory;
  labelKey: string;
  href: string;
}> = [
  { id: 'analysis', labelKey: 'reports.analysis', href: '/reports/analysis' },
  { id: 'occupancy', labelKey: 'reports.occupancy', href: '/reports/occupancy' },
  { id: 'daily', labelKey: 'reports.daily', href: '/reports/daily' },
  { id: 'financial', labelKey: 'reports.financial', href: '/reports/financial' },
  { id: 'agency', labelKey: 'reports.agency', href: '/reports/agency' },
  { id: 'booking', labelKey: 'reports.booking', href: '/reports/booking' },
];

export default function ReportsOverviewPage() {
  const t = useTranslations();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">{t('reports.overview')}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_CATEGORIES.map((cat) => {
          const count = REPORT_CATALOG.filter((r) => r.category === cat.id).length;
          return (
            <Link
              key={cat.id}
              href={cat.href}
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <h2 className="text-lg font-medium">{t(cat.labelKey as 'reports.analysis')}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {count} {t('reports.reportsCount')}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
