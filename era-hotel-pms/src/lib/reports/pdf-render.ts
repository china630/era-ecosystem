import PDFDocument from 'pdfkit';
import { registerUnicodeFonts, PDF_FONT_UNICODE, PDF_FONT_UNICODE_BOLD } from './pdf-font';
import { bindPdfI18n, pdfCellLabel, pdfHeaderLabel, reportPdfT } from './pdf-i18n';

export interface PdfTableColumn {
  header: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

export interface PdfRenderOptions {
  title: string;
  subtitle?: string;
  propertyName: string;
  generatedAt: string;
  locale: string;
  landscape?: boolean;
  t?: (key: string) => string;
}

const MARGIN = 30;
const FONT_SIZE = 9;
const HEADER_BG = '#3b5998';
const HEADER_FG = '#ffffff';
const STRIPE_BG = '#f2f4f8';
const ROW_HEIGHT = 16;
const HEADER_ROW_HEIGHT = 20;

export function createReportDoc(opts: PdfRenderOptions): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({
    size: 'A4',
    layout: opts.landscape !== false ? 'landscape' : 'portrait',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    bufferPages: true,
    autoFirstPage: true,
  });
  registerUnicodeFonts(doc);
  doc.font(PDF_FONT_UNICODE).fontSize(FONT_SIZE);
  bindPdfI18n(doc, opts.t ?? reportPdfT(opts.locale));
  return doc;
}

export function renderHeader(doc: InstanceType<typeof PDFDocument>, opts: PdfRenderOptions): void {
  const pageW = doc.page.width - MARGIN * 2;
  const y = MARGIN;

  doc.font(PDF_FONT_UNICODE_BOLD).fontSize(8);
  doc.text(opts.propertyName, MARGIN, y, { width: pageW / 3, align: 'left' });

  doc.fontSize(11);
  doc.text(opts.title, MARGIN + pageW / 3, y, { width: pageW / 3, align: 'center' });

  doc.font(PDF_FONT_UNICODE).fontSize(7);
  doc.text(opts.generatedAt, MARGIN + (pageW * 2) / 3, y, { width: pageW / 3, align: 'right' });

  if (opts.subtitle) {
    doc.font(PDF_FONT_UNICODE).fontSize(8);
    doc.text(opts.subtitle, MARGIN, y + 16, { width: pageW, align: 'center' });
  }

  doc.moveTo(MARGIN, y + 28).lineTo(MARGIN + pageW, y + 28).stroke();
  doc.y = y + 34;
}

export function renderTable(
  doc: InstanceType<typeof PDFDocument>,
  columns: PdfTableColumn[],
  rows: (string | number)[][],
  opts?: { groupHeaders?: string[] },
): void {
  const startX = MARGIN;
  let curY = doc.y;

  const drawHeaderRow = () => {
    doc.rect(startX, curY, columns.reduce((s, c) => s + c.width, 0), HEADER_ROW_HEIGHT)
      .fill(HEADER_BG);
    doc.fillColor(HEADER_FG).font(PDF_FONT_UNICODE_BOLD).fontSize(FONT_SIZE);
    let x = startX;
    for (const col of columns) {
      doc.text(pdfHeaderLabel(doc, col.header), x + 2, curY + 4, { width: col.width - 4, align: col.align ?? 'left' });
      x += col.width;
    }
    doc.fillColor('#000000');
    curY += HEADER_ROW_HEIGHT;
  };

  drawHeaderRow();

  doc.font(PDF_FONT_UNICODE).fontSize(FONT_SIZE);
  const pageBottom = doc.page.height - MARGIN - 20;

  for (let ri = 0; ri < rows.length; ri++) {
    if (curY + ROW_HEIGHT > pageBottom) {
      doc.addPage();
      curY = MARGIN;
      drawHeaderRow();
    }

    if (opts?.groupHeaders?.includes(String(rows[ri][0]))) {
      doc.font(PDF_FONT_UNICODE_BOLD);
    }

    if (ri % 2 === 1) {
      doc.rect(startX, curY, columns.reduce((s, c) => s + c.width, 0), ROW_HEIGHT)
        .fill(STRIPE_BG);
      doc.fillColor('#000000');
    }

    let x = startX;
    for (let ci = 0; ci < columns.length; ci++) {
      const raw = rows[ri][ci] ?? '';
      const val = pdfCellLabel(doc, raw);
      const align = columns[ci].align ?? (typeof raw === 'number' ? 'right' : 'left');
      doc.text(String(val), x + 2, curY + 3, { width: columns[ci].width - 4, align });
      x += columns[ci].width;
    }

    doc.font(PDF_FONT_UNICODE);
    curY += ROW_HEIGHT;
  }

  doc.y = curY;
}

export function renderFooter(
  doc: InstanceType<typeof PDFDocument>,
  pageNum: number,
  totalPages: number,
): void {
  const pageW = doc.page.width - MARGIN * 2;
  const y = doc.page.height - MARGIN;
  doc.font(PDF_FONT_UNICODE).fontSize(7);
  doc.text(`${pageNum} / ${totalPages}`, MARGIN, y, { width: pageW, align: 'center' });
}

export async function finishDoc(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      renderFooter(doc, i + 1, range.count);
    }

    doc.end();
  });
}
