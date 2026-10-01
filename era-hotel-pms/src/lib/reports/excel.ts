import * as XLSX from 'xlsx';
import { columnLabel } from './column-labels';
import { reportToSheets } from './tabular';

function headerRow(locale: string, columns: string[]): string[] {
  return columns.map((key) => columnLabel(locale, key));
}

export function reportToXlsxBuffer(data: unknown, locale: string): Buffer {
  const wb = XLSX.utils.book_new();
  const sheets = reportToSheets(data);
  if (sheets.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([[columnLabel(locale, 'field'), columnLabel(locale, 'value')]]);
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
  } else {
    for (const sheet of sheets) {
      const aoa = [headerRow(locale, sheet.columns), ...sheet.rows.map((row) => row.map((cell) => cell ?? ''))];
      const ws = XLSX.utils.aoa_to_sheet(aoa.length > 0 ? aoa : [['']]);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    }
  }
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}
