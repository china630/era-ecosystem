import os from 'node:os';
import PDFDocument from 'pdfkit';
import { registerUnicodeFonts, unicodeFontPath } from '../src/lib/reports/pdf-font';
import { createReportDoc, finishDoc, renderHeader } from '../src/lib/reports/pdf-render';

describe('pdf-font', () => {
  it('resolves DejaVu fonts from node_modules under cwd', () => {
    expect(unicodeFontPath('DejaVuSans.ttf')).toMatch(/dejavu-fonts-ttf[\\/]ttf[\\/]DejaVuSans\.ttf$/);
  });

  it('throws a readable error with the missing path', () => {
    expect(() => unicodeFontPath('DejaVuSans.ttf', os.tmpdir())).toThrow(/PDF font not found: .*DejaVuSans\.ttf/);
  });

  it('registers fonts on a pdfkit document', () => {
    const doc = new PDFDocument({ autoFirstPage: false });
    expect(() => registerUnicodeFonts(doc)).not.toThrow();
  });

  it('builds a report PDF buffer starting with %PDF', async () => {
    const opts = { title: 'Daily management', propertyName: 'Nafta', generatedAt: '2026-10-05', locale: 'en' };
    const doc = createReportDoc(opts);
    renderHeader(doc, opts);
    const buf = await finishDoc(doc);
    expect(buf.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });
});
