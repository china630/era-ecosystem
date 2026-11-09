import { mrzOcrOrientations, rotatedCropDrawParams, type CropRect } from '@/lib/mrz/crop-rect';

/**
 * Extract the selected (possibly angled) region into an upright bitmap for OCR.
 * `source` is the on-screen image element (natural pixels via scale in params).
 */
export function sampleRotatedCrop(
  source: CanvasImageSource,
  crop: CropRect,
  scaleX: number,
  scaleY: number,
): HTMLCanvasElement {
  const { canvasW, canvasH, centerX, centerY, unrotateRad } = rotatedCropDrawParams(
    crop,
    scaleX,
    scaleY,
  );
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.translate(canvasW / 2, canvasH / 2);
  ctx.rotate(unrotateRad);
  ctx.drawImage(source, -centerX, -centerY);
  return canvas;
}

/** Apply 0 / 90 / 270 after the crop sample so a vertical MRZ strip is tried upright. */
export function orientCropForOcr(sample: HTMLCanvasElement, crop: CropRect): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (const angle of mrzOcrOrientations(crop)) {
    if (angle === 0) {
      out.push(sample);
      continue;
    }
    const sideways = true;
    const canvas = document.createElement('canvas');
    canvas.width = sideways ? sample.height : sample.width;
    canvas.height = sideways ? sample.width : sample.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.drawImage(sample, -sample.width / 2, -sample.height / 2);
    out.push(canvas);
  }
  return out;
}
