import { createReportDoc, finishDoc, renderHeader, renderLayoutSections } from '@/lib/reports/pdf-render';
import { formatReportTimestamp } from '@/lib/reports/pdf-i18n';
import type { ReportLayout } from '@/lib/reports/layout';
import type { ReportLetterhead } from '@/lib/reports/letterhead';

export interface RenderCtx {
  propertyName: string;
  locale: string;
  title: string;
  subtitle?: string;
  t?: (key: string) => string;
  letterhead?: ReportLetterhead;
  landscape?: boolean;
}

/** Every catalog PDF: letterhead, title, period, then the slug layout sections. */
export async function renderLayoutPdf(layout: ReportLayout, ctx: RenderCtx): Promise<Buffer> {
  const opts = { ...ctx, generatedAt: formatReportTimestamp(ctx.locale), landscape: ctx.landscape ?? true };
  const doc = createReportDoc(opts);
  renderHeader(doc, opts);
  renderLayoutSections(doc, layout, ctx.locale, ctx.t?.('reportsPdf.noData') ?? 'No data for the selected period');
  return finishDoc(doc);
}
