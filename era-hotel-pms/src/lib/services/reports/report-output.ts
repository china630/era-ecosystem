import { formatLayoutText, type ReportLayout } from '@/lib/reports/layout';
import { buildReportLayout } from '@/lib/reports/layouts';
import { reportPdfT } from '@/lib/reports/pdf-i18n';
import { queryReport, type ReportQueryExtras } from './index';

/** Query a catalog slug and turn it into the shared layout used by screen, PDF and Excel. */
export async function queryReportLayout(
  slug: string,
  from: string,
  to: string,
  locale: string,
  extras?: ReportQueryExtras,
): Promise<ReportLayout> {
  const data = await queryReport(slug, from, to, extras);
  return buildReportLayout(slug, data, { t: reportPdfT(locale), locale, from, to });
}

export function reportPeriodLabel(from: string, to: string): string {
  const a = formatLayoutText(from, 'date');
  const b = formatLayoutText(to, 'date');
  return from === to ? a : `${a} — ${b}`;
}
