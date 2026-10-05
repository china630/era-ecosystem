import ExcelJS from 'exceljs';
import { letterheadContactLines, type ReportLetterhead } from './letterhead';
import { cellFormat, columnAlign, excelNumFmt, formatLayoutText, isEmphasisRow, type ReportLayout } from './layout';
import { NO_RATIO } from './ratio';

export interface XlsxHeaderOptions {
  letterhead?: ReportLetterhead;
  title?: string;
  period?: string;
  generatedAt?: string;
}

/** Rows used by the letterhead block; the first section starts right after them. */
export const XLSX_LETTERHEAD_ROWS = 7;

function sheetTitle(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim();
  return (cleaned || 'Report').slice(0, 31);
}

function logoExtension(buf: Buffer): 'png' | 'jpeg' {
  return buf[0] === 0x89 && buf[1] === 0x50 ? 'png' : 'jpeg';
}

/** Fixed block: name, address, contacts, blank, title, period · printed, blank. Empty values stay blank. */
export function writeXlsxLetterhead(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, opts: XlsxHeaderOptions): void {
  const lh = opts.letterhead;
  let textCol = 1;
  if (lh?.logo) {
    try {
      const imageId = wb.addImage({ buffer: lh.logo as unknown as ExcelJS.Buffer, extension: logoExtension(lh.logo) });
      ws.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 90, height: 40 } });
      textCol = 2;
    } catch {
      textCol = 1;
    }
  }
  const contacts = lh ? letterheadContactLines(lh) : [];
  const address = lh?.address ?? '';
  const contactLine = contacts.find((line) => line !== address) ?? '';
  const lines: { text: string; bold?: boolean; size?: number }[] = [
    { text: lh?.name ?? '', bold: true, size: 12 },
    { text: address, size: 9 },
    { text: contactLine, size: 9 },
    { text: '' },
    { text: opts.title ?? '', bold: true, size: 12 },
    { text: [opts.period, opts.generatedAt].filter(Boolean).join('   ·   '), size: 9 },
    { text: '' },
  ];
  lines.forEach((line, index) => {
    const row = ws.getRow(index + 1);
    const cell = row.getCell(index >= 4 ? 1 : textCol);
    cell.value = line.text;
    cell.font = { name: 'Calibri', bold: Boolean(line.bold), size: line.size ?? 11 };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
  });
}

const KIND_FILL: Record<string, string> = { group: 'FFE8EEF8', subtotal: 'FFF2F4F8', total: 'FFDDE3EC' };

/** One sheet: letterhead, then every layout section (title, header, rows) in PDF order. */
export async function layoutToXlsxBuffer(
  layout: ReportLayout,
  opts: XlsxHeaderOptions & { noDataLabel?: string } = {},
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetTitle(opts.title ?? layout.slug));
  writeXlsxLetterhead(wb, ws, opts);

  const widths: number[] = [];
  const track = (index: number, text: string) => {
    widths[index] = Math.min(48, Math.max(widths[index] ?? 10, text.length + 2));
  };

  let r = XLSX_LETTERHEAD_ROWS + 1;
  const sections = layout.sections.filter((s) => s.rows.length > 0);
  if (sections.length === 0) {
    ws.getRow(r).getCell(1).value = opts.noDataLabel ?? 'No data for the selected period';
  }
  for (const sec of sections) {
    if (sec.title) {
      const cell = ws.getRow(r).getCell(1);
      cell.value = sec.title;
      cell.font = { name: 'Calibri', bold: true, size: 11 };
      r += 1;
    }
    const header = ws.getRow(r);
    sec.columns.forEach((c, i) => {
      const cell = header.getCell(i + 1);
      cell.value = c.label;
      cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B5998' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      track(i, c.label.length > 24 ? c.label.slice(0, 24) : c.label);
    });
    r += 1;
    for (const lr of sec.rows) {
      const xr = ws.getRow(r);
      const emphasis = isEmphasisRow(lr);
      sec.columns.forEach((c, i) => {
        const cell = xr.getCell(i + 1);
        const format = cellFormat(lr, c);
        const value = lr.cells[i];
        if (value == null) {
          cell.value = format === 'pct' || format === 'money' ? NO_RATIO : '';
        } else {
          cell.value = typeof value === 'string' ? formatLayoutText(value, format) : value === 0 ? 0 : value;
          if (typeof value === 'number') {
            const numFmt = excelNumFmt(format);
            if (numFmt) cell.numFmt = numFmt;
          }
        }
        cell.alignment = { horizontal: columnAlign(c), vertical: 'middle' };
        if (emphasis) cell.font = { name: 'Calibri', bold: true };
        const fill = lr.kind ? KIND_FILL[lr.kind] : undefined;
        if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        track(i, typeof value === 'number' ? value.toFixed(2) : String(value ?? ''));
      });
      r += 1;
    }
    r += 1;
  }

  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
