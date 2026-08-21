import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getReportsByCategory } from '@/lib/reports/catalog';

export default function FinancialHubPage() {
  const t = useTranslations();
  const reports = getReportsByCategory('financial');

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">{t('reports.financial')}</h1>
      {reports.length === 0 ? (
        <p className="text-gray-500">{t('reports.noReports')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <Link
              key={r.id}
              href={r.href}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <h2 className="font-medium">{t(r.titleKey as 'reports.invoicesTitle')}</h2>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
