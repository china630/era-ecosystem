import { REPORT_CATALOG } from '@/lib/reports/catalog';
import { reportToXlsxBuffer } from '@/lib/reports/excel';
import { reportToSheets } from '@/lib/reports/tabular';
import { isImplementedReportSlug } from '@/lib/services/reports';

describe('hotel report workspace exports', () => {
  it('has a query for every catalog slug', () => {
    const missing = REPORT_CATALOG.filter((report) => !isImplementedReportSlug(report.slug)).map((r) => r.slug);
    expect(missing).toEqual([]);
  });

  it('flattens row reports and scalar manager views', () => {
    const sales = reportToSheets({
      rows: [{ sourceCode: 'DIRECT', roomNights: 2, revenue: 10 }],
      totalRevenue: 10,
    });
    expect(sales[0]?.name).toBe('Summary');
    expect(sales[1]?.columns).toEqual(['sourceCode', 'roomNights', 'revenue']);
    expect(sales[1]?.rows).toEqual([['DIRECT', 2, 10]]);

    const manager = reportToSheets({ occupancyPct: 80, totalRevenue: 12.5, arrivals: 1 });
    expect(manager).toHaveLength(1);
    expect(manager[0]?.columns).toEqual(['field', 'value']);
    expect(manager[0]?.rows).toContainEqual(['occupancyPct', 80]);
  });

  it('writes an xlsx workbook for an empty period', async () => {
    const buf = await reportToXlsxBuffer({ rows: [], totalRevenue: 0 }, 'az');
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK');
  });
});
