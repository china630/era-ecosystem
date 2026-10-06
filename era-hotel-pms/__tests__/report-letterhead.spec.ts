import ExcelJS from 'exceljs';
import { layoutToXlsxBuffer, XLSX_LETTERHEAD_ROWS } from '../src/lib/reports/excel';
import type { ReportLayout } from '../src/lib/reports/layout';
import { emptyLetterhead, letterheadContactLines, type ReportLetterhead } from '../src/lib/reports/letterhead';
import { createReportDoc, finishDoc, renderHeader } from '../src/lib/reports/pdf-render';

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const full: ReportLetterhead = {
  name: 'Nafta Sanatorium',
  address: 'Naftalan, Azerbaijan',
  phone: '+994 12 000 00 00',
  email: 'info@nafta.az',
  website: 'nafta.az',
  logo: PNG_1PX,
};

const revenue: ReportLayout = {
  slug: 'demo',
  sections: [{ id: 'revenue', columns: [{ key: 'revenue', label: 'Revenue', format: 'money' }], rows: [{ cells: [10] }] }],
};

async function readSheet(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  return wb.worksheets[0];
}

describe('report letterhead', () => {
  it('joins contacts and skips empty values', () => {
    expect(letterheadContactLines(full)).toEqual(['Naftalan, Azerbaijan', '+994 12 000 00 00  ·  info@nafta.az  ·  nafta.az']);
    expect(letterheadContactLines(emptyLetterhead('X'))).toEqual([]);
  });

  it('prints the same block above the table in Excel', async () => {
    const buf = await layoutToXlsxBuffer(revenue, {
      letterhead: full,
      title: 'Daily management',
      period: '2026-10-01',
    });
    const ws = await readSheet(buf);
    expect(ws.getRow(1).getCell(2).value).toBe('Nafta Sanatorium');
    expect(ws.getRow(2).getCell(2).value).toBe('Naftalan, Azerbaijan');
    expect(String(ws.getRow(3).getCell(2).value)).toContain('info@nafta.az');
    expect(ws.getRow(5).getCell(1).value).toBe('Daily management');
    expect(ws.getRow(XLSX_LETTERHEAD_ROWS + 1).getCell(1).value).toBe('Revenue');
  });

  it('keeps blank rows when contacts are empty', async () => {
    const buf = await layoutToXlsxBuffer({ slug: 'x', sections: [] }, { letterhead: emptyLetterhead('Hotel'), title: 'T' });
    const ws = await readSheet(buf);
    expect(ws.getRow(1).getCell(1).value).toBe('Hotel');
    expect(ws.getRow(2).getCell(1).value ?? '').toBe('');
  });

  it('renders a PDF with and without a logo', async () => {
    for (const letterhead of [full, emptyLetterhead(''), { ...full, logo: Buffer.from('not an image') }]) {
      const opts = { title: 'T', propertyName: 'P', generatedAt: 'now', locale: 'en', letterhead };
      const doc = createReportDoc(opts);
      renderHeader(doc, opts);
      const buf = await finishDoc(doc);
      expect(buf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    }
  });
});
