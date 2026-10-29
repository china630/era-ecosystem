/**
 * Buffet forecast pack (Wave 6) — guest-night bands × key SKU norms.
 * Canon: docs/adr/fnb-buffet-cost-attribution.md
 */

export type ForecastKeySkuNorm = {
  sku: string;
  name: string;
  /** Display unit (kg, L, pcs). */
  unit: string;
  /** Norm quantity per guest-night. */
  qtyPerGuestNight: number;
  /** Optional money norm AZN per guest-night. */
  aznPerGuestNight: number;
};

export type ForecastBand = {
  code: string;
  minGuestNights: number;
  /** null = open-ended upper bound. */
  maxGuestNights: number | null;
};

export type BuffetForecastPack = {
  keySkuNorms: ForecastKeySkuNorm[];
  bands: ForecastBand[];
};

export function defaultForecastBands(): ForecastBand[] {
  return [
    { code: "LOW", minGuestNights: 0, maxGuestNights: 149 },
    { code: "MID", minGuestNights: 150, maxGuestNights: 249 },
    { code: "HIGH", minGuestNights: 250, maxGuestNights: null },
  ];
}

export function defaultKeySkuNorms(): ForecastKeySkuNorm[] {
  return [
    { sku: "MEAT", name: "Meat", unit: "kg", qtyPerGuestNight: 0, aznPerGuestNight: 0 },
    { sku: "OIL", name: "Oil", unit: "L", qtyPerGuestNight: 0, aznPerGuestNight: 0 },
    { sku: "FLOUR", name: "Flour", unit: "kg", qtyPerGuestNight: 0, aznPerGuestNight: 0 },
    { sku: "PASTA", name: "Pasta", unit: "kg", qtyPerGuestNight: 0, aznPerGuestNight: 0 },
  ];
}

export function defaultBuffetForecastPack(): BuffetForecastPack {
  return {
    keySkuNorms: defaultKeySkuNorms(),
    bands: defaultForecastBands(),
  };
}

function asNonNeg(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n * 1000) / 1000;
}

function asMoney(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n * 100) / 100;
}

function normalizeBand(raw: unknown): ForecastBand | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const code = typeof src.code === "string" ? src.code.trim().toUpperCase() : "";
  if (!code) return null;
  const min = Math.max(0, Math.floor(asNonNeg(src.minGuestNights, 0)));
  let max: number | null = null;
  if (src.maxGuestNights != null && src.maxGuestNights !== "") {
    max = Math.max(0, Math.floor(asNonNeg(src.maxGuestNights, min)));
    if (max < min) max = min;
  }
  return { code, minGuestNights: min, maxGuestNights: max };
}

function normalizeNorm(raw: unknown): ForecastKeySkuNorm | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const sku = typeof src.sku === "string" ? src.sku.trim().toUpperCase() : "";
  if (!sku) return null;
  const name =
    typeof src.name === "string" && src.name.trim()
      ? src.name.trim()
      : sku;
  const unit =
    typeof src.unit === "string" && src.unit.trim() ? src.unit.trim() : "kg";
  return {
    sku,
    name,
    unit,
    qtyPerGuestNight: asNonNeg(src.qtyPerGuestNight, 0),
    aznPerGuestNight: asMoney(src.aznPerGuestNight, 0),
  };
}

/** Parse forecast pack from settings JSON (or null → defaults). */
export function parseBuffetForecastPack(raw: unknown): BuffetForecastPack {
  const base = defaultBuffetForecastPack();
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const normsRaw = Array.isArray(src.keySkuNorms) ? src.keySkuNorms : null;
  const keySkuNorms: ForecastKeySkuNorm[] = [];
  if (normsRaw) {
    for (const row of normsRaw) {
      const n = normalizeNorm(row);
      if (n) keySkuNorms.push(n);
    }
  }

  const bandsRaw = Array.isArray(src.bands) ? src.bands : null;
  const bands: ForecastBand[] = [];
  if (bandsRaw) {
    for (const row of bandsRaw) {
      const b = normalizeBand(row);
      if (b) bands.push(b);
    }
  }

  return {
    keySkuNorms: keySkuNorms.length > 0 ? keySkuNorms : base.keySkuNorms,
    bands: bands.length > 0 ? bands : base.bands,
  };
}

export type ForecastSkuLine = {
  sku: string;
  name: string;
  unit: string;
  qtyPerGuestNight: number;
  aznPerGuestNight: number;
  forecastQty: number;
  forecastAzn: number;
};

export type ForecastPackResult = {
  guestNights: number;
  band: ForecastBand | null;
  bandCode: string | null;
  lines: ForecastSkuLine[];
  totalForecastAzn: number;
};

/** Resolve band for a guest-night total (first matching inclusive range). */
export function resolveForecastBand(
  guestNights: number,
  bands: ForecastBand[],
): ForecastBand | null {
  const n = Math.max(0, Math.floor(guestNights));
  const sorted = [...bands].sort((a, b) => a.minGuestNights - b.minGuestNights);
  for (const b of sorted) {
    if (n < b.minGuestNights) continue;
    if (b.maxGuestNights == null || n <= b.maxGuestNights) return b;
  }
  return sorted.length > 0 ? sorted[sorted.length - 1]! : null;
}

/** Build key-SKU forecast for a guest-night total. */
export function buildForecastPack(args: {
  guestNights: number;
  pack: BuffetForecastPack;
}): ForecastPackResult {
  const guestNights = Math.max(0, Math.floor(args.guestNights));
  const band = resolveForecastBand(guestNights, args.pack.bands);
  const lines: ForecastSkuLine[] = args.pack.keySkuNorms.map((norm) => {
    const forecastQty =
      Math.round(norm.qtyPerGuestNight * guestNights * 1000) / 1000;
    const forecastAzn =
      Math.round(norm.aznPerGuestNight * guestNights * 100) / 100;
    return {
      sku: norm.sku,
      name: norm.name,
      unit: norm.unit,
      qtyPerGuestNight: norm.qtyPerGuestNight,
      aznPerGuestNight: norm.aznPerGuestNight,
      forecastQty,
      forecastAzn,
    };
  });
  const totalForecastAzn =
    Math.round(lines.reduce((s, r) => s + r.forecastAzn, 0) * 100) / 100;
  return {
    guestNights,
    band,
    bandCode: band?.code ?? null,
    lines,
    totalForecastAzn,
  };
}
