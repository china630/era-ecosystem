import { isPdfFile, isSupportedScanFile } from '@/lib/mrz/pdf-page';

describe('mrz pdf page', () => {
  it('detects PDF by MIME or extension', () => {
    expect(isPdfFile(new File([], 'scan.pdf', { type: 'application/pdf' }))).toBe(true);
    expect(isPdfFile(new File([], 'scan.PDF', { type: '' }))).toBe(true);
    expect(isPdfFile(new File([], 'photo.jpg', { type: 'image/jpeg' }))).toBe(false);
  });

  it('accepts JPEG/PNG/WebP/PDF and rejects other types', () => {
    expect(isSupportedScanFile(new File([], 'a.webp', { type: 'image/webp' }))).toBe(true);
    expect(isSupportedScanFile(new File([], 'a.PNG', { type: '' }))).toBe(true);
    expect(isSupportedScanFile(new File([], 'a.gif', { type: 'image/gif' }))).toBe(false);
    expect(isSupportedScanFile(new File([], 'a.docx', { type: '' }))).toBe(false);
  });
});
