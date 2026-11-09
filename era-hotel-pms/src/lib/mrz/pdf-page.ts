/**
 * Rasterize the first page of a PDF to a PNG blob for the MRZ crop UI.
 * Client-only; uses pdfjs-dist dynamically. Worker is served from `/pdf.worker.min.mjs`.
 */
export async function rasterizePdfFirstPage(file: File): Promise<Blob> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  if (doc.numPages < 1) {
    throw new Error('PDF_EMPTY');
  }
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('PDF_CANVAS');
  }
  await page.render({ canvasContext: ctx, viewport }).promise;
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });
  if (!blob) {
    throw new Error('PDF_BLOB');
  }
  return blob;
}

export function isPdfFile(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (type === 'application/pdf') return true;
  return file.name.toLowerCase().endsWith('.pdf');
}

export function isSupportedScanFile(file: File): boolean {
  if (isPdfFile(file)) return true;
  const type = (file.type || '').toLowerCase();
  if (type === 'image/jpeg' || type === 'image/png' || type === 'image/webp') return true;
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp')
  );
}
