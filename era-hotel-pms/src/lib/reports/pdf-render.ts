import PDFDocument from 'pdfkit';
import { registerUnicodeFonts, PDF_FONT_UNICODE, PDF_FONT_UNICODE_BOLD } from './pdf-font';
import { bindPdfI18n, pdfCellLabel, pdfHeaderLabel, reportPdfT } from './pdf-i18n';
import { isReportTotalLabel, isReportTotalRow, reportCellAlign } from './report-align';
import { emptyLetterhead, letterheadContactLines, type ReportLetterhead } from './letterhead';
import { cellFormat, columnAlign, formatLayoutCell, type LayoutRowKind, type ReportLayout } from './layout';

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
  letterhead?: ReportLetterhead;
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

const LOGO_BOX = { width: 90, height: 40 };

/** Logo, hotel name and contacts on the left, print time on the right. Returns the y below the block. */
export function drawLetterhead(
  doc: InstanceType<typeof PDFDocument>,
  letterhead: ReportLetterhead,
  area: { x: number; y: number; width: number; generatedAt?: string },
): number {
  const { x, y, width } = area;
  let textX = x;
  let bottom = y;
  if (letterhead.logo) {
    try {
      doc.image(letterhead.logo, x, y, { fit: [LOGO_BOX.width, LOGO_BOX.height] });
      textX = x + LOGO_BOX.width + 8;
      bottom = y + LOGO_BOX.height;
    } catch {
      textX = x;
    }
  }

  const rightW = 150;
  const textW = Math.max(120, width - (textX - x) - rightW);
  let ty = y;
  if (letterhead.name) {
    doc.font(PDF_FONT_UNICODE_BOLD).fontSize(10).fillColor('#000000');
    doc.text(letterhead.name, textX, ty, { width: textW, align: 'left', lineBreak: false, ellipsis: true });
    ty += 13;
  }
  doc.font(PDF_FONT_UNICODE).fontSize(7).fillColor('#444444');
  for (const line of letterheadContactLines(letterhead)) {
    doc.text(line, textX, ty, { width: textW, align: 'left', lineBreak: false, ellipsis: true });
    ty += 9;
  }
  doc.fillColor('#000000');
  bottom = Math.max(bottom, ty);

  if (area.generatedAt) {
    doc.font(PDF_FONT_UNICODE).fontSize(7);
    doc.text(area.generatedAt, x + width - rightW, y, { width: rightW, align: 'right', lineBreak: false });
    bottom = Math.max(bottom, y + 9);
  }
  return bottom;
}

export function renderHeader(doc: InstanceType<typeof PDFDocument>, opts: PdfRenderOptions): void {
  const pageW = doc.page.width - MARGIN * 2;
  const letterhead = opts.letterhead ?? emptyLetterhead(opts.propertyName);
  let y = drawLetterhead(doc, letterhead, { x: MARGIN, y: MARGIN, width: pageW, generatedAt: opts.generatedAt }) + 6;

  doc.font(PDF_FONT_UNICODE_BOLD).fontSize(12);
  doc.text(opts.title, MARGIN, y, { width: pageW, align: 'center' });
  y += 15;

  if (opts.subtitle) {
    doc.font(PDF_FONT_UNICODE).fontSize(8);
    doc.text(opts.subtitle, MARGIN, y, { width: pageW, align: 'center' });
    y += 11;
  }

  doc.moveTo(MARGIN, y + 2).lineTo(MARGIN + pageW, y + 2).stroke();
  doc.font(PDF_FONT_UNICODE).fontSize(FONT_SIZE);
  doc.y = y + 8;
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
      doc.text(pdfHeaderLabel(doc, col.header), x + 2, curY + 4, { width: col.width - 4, align: 'center' });
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

    const totalRow =
      isReportTotalRow(rows[ri]) ||
      (opts?.groupHeaders ?? []).some((label) => rows[ri].some((cell) => String(cell) === label || isReportTotalLabel(cell)));
    if (totalRow) {
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
      const align = columns[ci].align ?? reportCellAlign(raw);
      doc.text(String(val), x + 2, curY + 3, { width: columns[ci].width - 4, align });
      x += columns[ci].width;
    }

    doc.font(PDF_FONT_UNICODE);
    curY += ROW_HEIGHT;
  }

  doc.y = curY;
}

const KIND_BG: Partial<Record<LayoutRowKind, string>> = {
  group: '#e8eef8',
  subtotal: '#f2f4f8',
  total: '#dde3ec',
};

function layoutFontSize(columnCount: number): number {
  if (columnCount > 12) return 6.5;
  if (columnCount > 9) return 7.5;
  return FONT_SIZE;
}

/** Draws every layout section: optional title, header (repeated after page breaks), styled group / subtotal / total rows. */
export function renderLayoutSections(
  doc: InstanceType<typeof PDFDocument>,
  layout: ReportLayout,
  locale: string,
  noDataLabel: string,
): void {
  const pageW = doc.page.width - MARGIN * 2;
  const pageBottom = () => doc.page.height - MARGIN - 20;
  const nonEmpty = layout.sections.filter((s) => s.rows.length > 0);
  if (nonEmpty.length === 0) {
    doc.font(PDF_FONT_UNICODE).fontSize(FONT_SIZE).fillColor('#444444');
    doc.text(noDataLabel, MARGIN, doc.y + 4, { width: pageW, align: 'center' });
    doc.fillColor('#000000');
    return;
  }

  for (const sec of nonEmpty) {
    const fontSize = layoutFontSize(sec.columns.length);
    const rowH = Math.max(12, Math.round(fontSize * 1.8));
    const totalWeight = sec.columns.reduce((s, c) => s + (c.weight ?? 1), 0);
    const widths = sec.columns.map((c) => (pageW * (c.weight ?? 1)) / totalWeight);

    doc.font(PDF_FONT_UNICODE_BOLD).fontSize(fontSize);
    const headerH = Math.max(
      HEADER_ROW_HEIGHT,
      ...sec.columns.map((c, i) => doc.heightOfString(c.label, { width: widths[i] - 4, align: 'center' }) + 6),
    );

    let y = doc.y + 4;
    const needTitle = Boolean(sec.title);
    if (y + (needTitle ? 16 : 0) + headerH + rowH > pageBottom()) {
      doc.addPage();
      y = MARGIN;
    }
    if (sec.title) {
      doc.font(PDF_FONT_UNICODE_BOLD).fontSize(10).fillColor('#000000');
      doc.text(sec.title, MARGIN, y, { width: pageW, align: 'left', lineBreak: false });
      y += 15;
    }

    const drawHeader = () => {
      doc.rect(MARGIN, y, pageW, headerH).fill(HEADER_BG);
      doc.fillColor(HEADER_FG).font(PDF_FONT_UNICODE_BOLD).fontSize(fontSize);
      let x = MARGIN;
      sec.columns.forEach((c, i) => {
        doc.text(c.label, x + 2, y + 3, { width: widths[i] - 4, align: 'center' });
        x += widths[i];
      });
      doc.fillColor('#000000');
      y += headerH;
    };
    drawHeader();

    sec.rows.forEach((r, ri) => {
      if (y + rowH > pageBottom()) {
        doc.addPage();
        y = MARGIN;
        drawHeader();
      }
      const kind = r.kind ?? 'data';
      const bg = KIND_BG[kind] ?? (ri % 2 === 1 ? STRIPE_BG : null);
      if (bg) {
        doc.rect(MARGIN, y, pageW, rowH).fill(bg);
        doc.fillColor('#000000');
      }
      if (kind === 'subtotal' || kind === 'total') {
        doc.moveTo(MARGIN, y).lineTo(MARGIN + pageW, y).lineWidth(0.5).stroke();
      }
      doc.font(kind === 'data' ? PDF_FONT_UNICODE : PDF_FONT_UNICODE_BOLD).fontSize(fontSize);
      let x = MARGIN;
      sec.columns.forEach((c, i) => {
        const text = formatLayoutCell(r.cells[i] === undefined ? '' : r.cells[i], cellFormat(r, c), locale);
        if (text) {
          doc.text(text, x + 2, y + (rowH - fontSize) / 2 - 1, {
            width: widths[i] - 4,
            align: columnAlign(c),
            lineBreak: false,
            ellipsis: true,
          });
        }
        x += widths[i];
      });
      y += rowH;
    });
    doc.font(PDF_FONT_UNICODE).fontSize(FONT_SIZE);
    doc.y = y + 8;
  }
}

export function renderFooter(
  doc: InstanceType<typeof PDFDocument>,
  pageNum: number,
  totalPages: number,
): void {
  const pageW = doc.page.width - MARGIN * 2;
  const y = doc.page.height - MARGIN - 4;
  const bottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.font(PDF_FONT_UNICODE).fontSize(7);
  doc.text(`${pageNum} / ${totalPages}`, MARGIN, y, { width: pageW, align: 'center', lineBreak: false });
  doc.page.margins.bottom = bottom;
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
