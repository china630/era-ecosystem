import fs from 'node:fs';
import path from 'node:path';
import type PDFKit from 'pdfkit';

export const PDF_FONT_UNICODE = 'DejaVuSans' as const;
export const PDF_FONT_UNICODE_BOLD = 'DejaVuSans-Bold' as const;

const FONT_DIR_SEGMENTS = ['node_modules', 'dejavu-fonts-ttf', 'ttf'] as const;

/** Bundled Next has no usable `createRequire().resolve`; fonts are traced into `node_modules` next to the server. */
export function unicodeFontPath(file: 'DejaVuSans.ttf' | 'DejaVuSans-Bold.ttf', root = process.cwd()): string {
  const full = path.join(root, ...FONT_DIR_SEGMENTS, file);
  if (!fs.existsSync(full)) {
    throw new Error(`PDF font not found: ${full} (install dejavu-fonts-ttf next to the server)`);
  }
  return full;
}

export function registerUnicodeFonts(doc: PDFKit.PDFDocument): void {
  doc.registerFont(PDF_FONT_UNICODE, unicodeFontPath('DejaVuSans.ttf'));
  doc.registerFont(PDF_FONT_UNICODE_BOLD, unicodeFontPath('DejaVuSans-Bold.ttf'));
}
