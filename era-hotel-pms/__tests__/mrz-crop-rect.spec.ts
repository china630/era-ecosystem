import {
  clampCropAngle,
  clampCropPoint,
  clientPointInBox,
  cropRectFromPoints,
  isUsableCrop,
  mrzOcrOrientations,
  MRZ_CROP_ANGLE_MAX,
  MRZ_CROP_ANGLE_MIN,
  MRZ_CROP_MIN_PX,
  rotatedCropDrawParams,
  withCropAngle,
} from '@/lib/mrz/crop-rect';

describe('mrz crop rect', () => {
  it('builds a rectangle from opposite corners in any drag direction', () => {
    expect(cropRectFromPoints({ x: 10, y: 20 }, { x: 110, y: 80 })).toEqual({
      x: 10,
      y: 20,
      w: 100,
      h: 60,
      angleDeg: 0,
    });
    expect(cropRectFromPoints({ x: 110, y: 80 }, { x: 10, y: 20 }, 12)).toEqual({
      x: 10,
      y: 20,
      w: 100,
      h: 60,
      angleDeg: 12,
    });
  });

  it('rejects a click-sized point as unusable', () => {
    expect(isUsableCrop(null)).toBe(false);
    expect(isUsableCrop({ x: 5, y: 5, w: 0, h: 0, angleDeg: 0 })).toBe(false);
    expect(isUsableCrop({ x: 5, y: 5, w: MRZ_CROP_MIN_PX - 1, h: 40, angleDeg: 0 })).toBe(false);
    expect(isUsableCrop({ x: 5, y: 5, w: 40, h: MRZ_CROP_MIN_PX, angleDeg: 0 })).toBe(true);
  });

  it('clamps the pointer inside the image box', () => {
    expect(clampCropPoint({ x: -10, y: 50 }, { width: 200, height: 100 })).toEqual({
      x: 0,
      y: 50,
    });
    expect(clampCropPoint({ x: 250, y: 150 }, { width: 200, height: 100 })).toEqual({
      x: 200,
      y: 100,
    });
  });

  it('maps client coords relative to the crop box and keeps drag outside the box usable', () => {
    const box = { left: 100, top: 50, width: 400, height: 300, right: 500, bottom: 350 } as DOMRect;
    const start = clientPointInBox(120, 70, box);
    const outside = clientPointInBox(80, 400, box);
    expect(start).toEqual({ x: 20, y: 20 });
    expect(outside).toEqual({ x: 0, y: 300 });
    expect(isUsableCrop(cropRectFromPoints(start, outside))).toBe(true);
  });

  it('clamps skew angle and preserves it when adjusting the crop', () => {
    expect(clampCropAngle(-90)).toBe(MRZ_CROP_ANGLE_MIN);
    expect(clampCropAngle(90)).toBe(MRZ_CROP_ANGLE_MAX);
    expect(withCropAngle({ x: 1, y: 2, w: 40, h: 20, angleDeg: 0 }, 18).angleDeg).toBe(18);
  });

  it('builds unrotate params for a skewed crop and picks vertical OCR orientations', () => {
    const params = rotatedCropDrawParams(
      { x: 10, y: 20, w: 100, h: 40, angleDeg: 15 },
      2,
      2,
    );
    expect(params.canvasW).toBe(200);
    expect(params.canvasH).toBe(80);
    expect(params.centerX).toBe(120);
    expect(params.centerY).toBe(80);
    expect(params.unrotateRad).toBeCloseTo((-15 * Math.PI) / 180);
    expect(mrzOcrOrientations({ x: 0, y: 0, w: 40, h: 120, angleDeg: 0 })).toEqual([90, 270]);
    expect(mrzOcrOrientations({ x: 0, y: 0, w: 120, h: 40, angleDeg: 10 })).toEqual([0]);
  });
});
