export type CropPoint = { x: number; y: number };
export type CropRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Clockwise degrees relative to the image; used to straighten skewed scans. */
  angleDeg: number;
};

/** Minimum on-screen crop size before OCR is allowed. */
export const MRZ_CROP_MIN_PX = 8;

/** Skew adjustment range for the angle slider (degrees). */
export const MRZ_CROP_ANGLE_MIN = -45;
export const MRZ_CROP_ANGLE_MAX = 45;

export function clampCropAngle(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return Math.max(MRZ_CROP_ANGLE_MIN, Math.min(MRZ_CROP_ANGLE_MAX, deg));
}

export function cropRectFromPoints(
  origin: CropPoint,
  point: CropPoint,
  angleDeg = 0,
): CropRect {
  return {
    x: Math.min(origin.x, point.x),
    y: Math.min(origin.y, point.y),
    w: Math.abs(point.x - origin.x),
    h: Math.abs(point.y - origin.y),
    angleDeg: clampCropAngle(angleDeg),
  };
}

export function withCropAngle(rect: CropRect, angleDeg: number): CropRect {
  return { ...rect, angleDeg: clampCropAngle(angleDeg) };
}

/** Clamp a point into the element box (client coords relative to box). */
export function clampCropPoint(
  point: CropPoint,
  box: { width: number; height: number },
): CropPoint {
  return {
    x: Math.max(0, Math.min(box.width, point.x)),
    y: Math.max(0, Math.min(box.height, point.y)),
  };
}

export function isUsableCrop(rect: CropRect | null | undefined): rect is CropRect {
  return Boolean(rect && rect.w >= MRZ_CROP_MIN_PX && rect.h >= MRZ_CROP_MIN_PX);
}

export function clientPointInBox(
  clientX: number,
  clientY: number,
  box: DOMRect,
): CropPoint {
  return clampCropPoint(
    { x: clientX - box.left, y: clientY - box.top },
    { width: box.width, height: box.height },
  );
}

/** Params to extract a (possibly skewed) crop into an upright OCR canvas. */
export function rotatedCropDrawParams(
  crop: CropRect,
  scaleX: number,
  scaleY: number,
): {
  canvasW: number;
  canvasH: number;
  centerX: number;
  centerY: number;
  /** Radians to rotate the source image so the selection becomes axis-aligned. */
  unrotateRad: number;
} {
  return {
    canvasW: Math.max(1, Math.round(crop.w * scaleX)),
    canvasH: Math.max(1, Math.round(crop.h * scaleY)),
    centerX: (crop.x + crop.w / 2) * scaleX,
    centerY: (crop.y + crop.h / 2) * scaleY,
    unrotateRad: (-clampCropAngle(crop.angleDeg) * Math.PI) / 180,
  };
}

/** Extra canvas orientations after the crop is straightened (vertical MRZ strip). */
export function mrzOcrOrientations(crop: CropRect): number[] {
  return crop.h > crop.w ? [90, 270] : [0];
}
