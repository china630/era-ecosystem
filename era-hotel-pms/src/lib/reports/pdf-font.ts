import { createRequire } from 'node:module';
import path from 'node:path';
import type PDFKit from 'pdfkit';

const requireFont = createRequire(path.join(process.cwd(), 'package.json'));

export const PDF_FONT_UNICODE = 'DejaVuSans' as const;
export const PDF_FONT_UNICODE_BOLD = 'DejaVuSans-Bold' as const;

export function registerUnicodeFonts(doc: PDFKit.PDFDocument): void {
  const regular = requireFont.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
  const bold = requireFont.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');
  doc.registerFont(PDF_FONT_UNICODE, regular);
  doc.registerFont(PDF_FONT_UNICODE_BOLD, bold);
}
