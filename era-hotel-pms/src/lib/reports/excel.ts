import ExcelJS from 'exceljs';
import { columnLabel } from './column-labels';
import { isReportTotalRow, reportCellAlign } from './report-align';
import { reportToSheets } from './tabular';

function sheetTitle(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim();
  return (cleaned || 'Report').slice(0, 31);
}

export async function reportToXlsxBuffer(data: unknown, locale: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheets = reportToSheets(data);
  const tables =
    sheets.length > 0
      ? sheets
      : [{ name: 'Report', columns: ['field', 'value'], rows: [] as (string | number | null)[][] }];

  for (const sheet of tables) {
    const ws = wb.addWorksheet(sheetTitle(sheet.name));
    const headers = sheet.columns.map((key) => columnLabel(locale, key));
    const header = ws.addRow(headers);
    header.font = { name: 'Calibri', bold: true };
    header.alignment = { horizontal: 'center', vertical: 'middle' };
    header.eachCell((cell) => {
      cell.font = { name: 'Calibri', bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    for (const row of sheet.rows) {
      const added = ws.addRow(row.map((cell) => cell ?? ''));
      const total = isReportTotalRow(row);
      row.forEach((value, index) => {
        const cell = added.getCell(index + 1);
        const align = reportCellAlign(value);
        cell.alignment = { horizontal: align, vertical: 'middle' };
        if (total) cell.font = { name: 'Calibri', bold: true };
        if (typeof value === 'number') cell.numFmt = Number.isInteger(value) ? '#,##0' : '#,##0.00';
      });
    }

    sheet.columns.forEach((key, index) => {
      const headerText = headers[index] ?? key;
      const width = Math.min(42, Math.max(12, headerText.length + 2));
      ws.getColumn(index + 1).width = width;
    });
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
