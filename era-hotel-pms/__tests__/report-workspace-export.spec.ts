import ExcelJS from 'exceljs';
import { REPORT_CATALOG } from '@/lib/reports/catalog';
import { layoutToXlsxBuffer, XLSX_LETTERHEAD_ROWS } from '@/lib/reports/excel';
import { hasReportLayout } from '@/lib/reports/layouts';
import { formatLayoutCell, row, type ReportLayout } from '@/lib/reports/layout';
import { isImplementedReportSlug } from '@/lib/services/reports';

const layout: ReportLayout = {
  slug: 'demo',
  sections: [
    {
      id: 'rooms',
      title: 'Rooms',
      columns: [
        { key: 'metric', label: 'Indicator', format: 'text' },
        { key: 'today', label: 'Today', format: 'int' },
      ],
      rows: [row(['Rooms sold', 12], 'data', 'int'), row(['Bed %', null], 'data', 'pct')],
    },
    {
      id: 'payments',
      title: 'Payments',
      columns: [
        { key: 'method', label: 'Payment method', format: 'text' },
        { key: 'amount', label: 'Amount', format: 'money' },
      ],
      rows: [row(['Cash', 100]), row(['Total', 100], 'total')],
    },
  ],
};

describe('hotel report workspace exports', () => {
  it('has a query and a layout builder for every catalog slug', () => {
    const noQuery = REPORT_CATALOG.filter((r) => !isImplementedReportSlug(r.slug)).map((r) => r.slug);
    const noLayout = REPORT_CATALOG.filter((r) => !hasReportLayout(r.slug)).map((r) => r.slug);
    expect(noQuery).toEqual([]);
    expect(noLayout).toEqual([]);
  });

  it('prints an em dash for an undefined ratio and keeps blank text cells', () => {
    expect(formatLayoutCell(null, 'pct', 'en')).toBe('—');
    expect(formatLayoutCell(null, 'money', 'en')).toBe('—');
    expect(formatLayoutCell('', 'money', 'en')).toBe('');
    expect(formatLayoutCell(81.25, 'pct', 'en')).toBe('81.3%');
  });

  it('prints ISO days in date columns as DD.MM.YYYY and leaves labels alone', () => {
    expect(formatLayoutCell('2026-10-04', 'date', 'en')).toBe('04.10.2026');
    expect(formatLayoutCell('2026-10-04 09:15', 'datetime', 'en')).toBe('04.10.2026 09:15');
    expect(formatLayoutCell('Total', 'date', 'en')).toBe('Total');
    expect(formatLayoutCell('2026-10-04', 'text', 'en')).toBe('2026-10-04');
  });

  it('stacks the same sections as the PDF under the letterhead', async () => {
    const buf = await layoutToXlsxBuffer(layout, { title: 'Daily management' });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];
    const start = XLSX_LETTERHEAD_ROWS + 1;
    expect(ws.getRow(start).getCell(1).value).toBe('Rooms');
    expect(ws.getRow(start + 1).getCell(2).value).toBe('Today');
    expect(ws.getRow(start + 2).getCell(2).value).toBe(12);
    expect(ws.getRow(start + 3).getCell(2).value).toBe('—');
    expect(ws.getRow(start + 5).getCell(1).value).toBe('Payments');
    expect(ws.getRow(start + 8).getCell(1).value).toBe('Total');
  });

  it('writes an xlsx workbook for an empty layout', async () => {
    const buf = await layoutToXlsxBuffer({ slug: 'x', sections: [] }, { noDataLabel: 'Empty' });
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK');
  });
});
