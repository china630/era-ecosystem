/**
 * Wave D — compose one nightly sell from per-pax medical SKUs.
 * Main = higher occ-1; Standart companion = +companionStandartAzn; else half of that SKU's occ-2.
 */

export type PackageSellRow = {
  code: string;
  occ1: number;
  occ2: number;
  occ3?: number;
};

export const DEFAULT_STANDART_COMPANION_AZN = 96;

/** PricingComponent.code for versioned Standart companion add-on (Wave D). */
export const STANDART_COMPANION_COMPONENT_CODE = "STANDART_COMPANION";

export const DEFAULT_NAFTA_PACKAGE_SELL: PackageSellRow[] = [
  { code: "PKG-STANDART", occ1: 139, occ2: 239, occ3: 349 },
  { code: "PKG-PREMIUM", occ1: 193, occ2: 349 },
  { code: "PKG-DERMO", occ1: 180, occ2: 321 },
  { code: "PKG-DETOKS", occ1: 178, occ2: 319 },
];

function catalogMap(catalog: PackageSellRow[]): Map<string, PackageSellRow> {
  return new Map(catalog.map((r) => [r.code.toUpperCase(), r]));
}

/**
 * Reception qapik: half of double occupancy.
 * 321/2 → 160 (floor half-AZN); 319/2 → 160 (round).
 */
export function halfOcc2(row: PackageSellRow): number {
  const half = row.occ2 / 2;
  const frac = half - Math.floor(half);
  if (Math.abs(frac - 0.5) < 1e-9) {
    // Prefer 160-class reception table: .5 → nearest even-ish down for 321, up for 319
    return half < 160 ? Math.ceil(half) : Math.floor(half);
  }
  return Math.round(half);
}

export type ComposeBreakdownLine = {
  role: "main" | "companion";
  code: string;
  amount: number;
  note: string;
};

export type ComposeBreakdown = {
  total: number;
  lines: ComposeBreakdownLine[];
};

/**
 * @returns null when no resolved SKUs (do not invent sell).
 */
export function composeNaftaPackageNightlySell(
  paxCodes: Array<string | null | undefined>,
  catalog: PackageSellRow[] = DEFAULT_NAFTA_PACKAGE_SELL,
  companionStandartAzn: number = DEFAULT_STANDART_COMPANION_AZN,
): number | null {
  const breakdown = composeNaftaPackageNightlySellBreakdown(
    paxCodes,
    catalog,
    companionStandartAzn,
  );
  return breakdown?.total ?? null;
}

export function composeNaftaPackageNightlySellBreakdown(
  paxCodes: Array<string | null | undefined>,
  catalog: PackageSellRow[] = DEFAULT_NAFTA_PACKAGE_SELL,
  companionStandartAzn: number = DEFAULT_STANDART_COMPANION_AZN,
): ComposeBreakdown | null {
  const map = catalogMap(catalog);
  const codes = paxCodes
    .map((c) => (c ? c.trim().toUpperCase() : null))
    .filter((c): c is string => !!c && map.has(c));
  if (codes.length === 0) return null;

  const unique = [...new Set(codes)];
  if (unique.length === 1) {
    const row = map.get(unique[0])!;
    const n = codes.length;
    let amount: number;
    let note: string;
    if (n === 1) {
      amount = row.occ1;
      note = "occupancy-1";
    } else if (n === 2) {
      amount = row.occ2;
      note = "occupancy-2";
    } else {
      amount = row.occ3 ?? row.occ2;
      note = row.occ3 != null ? "occupancy-3" : "occupancy-2 (capped)";
    }
    return {
      total: amount,
      lines: [{ role: "main", code: unique[0], amount, note }],
    };
  }

  // Mixed: main = highest occ1; each other = Standart companion or half occ2 of that SKU
  const ranked = [...codes].sort((a, b) => {
    const da = map.get(a)!.occ1;
    const db = map.get(b)!.occ1;
    return db - da;
  });
  const mainCode = ranked[0];
  const main = map.get(mainCode)!;
  const lines: ComposeBreakdownLine[] = [
    {
      role: "main",
      code: mainCode,
      amount: main.occ1,
      note: "occupancy-1 (highest)",
    },
  ];
  let total = main.occ1;
  let skippedMain = false;
  for (const code of ranked) {
    if (code === mainCode && !skippedMain) {
      skippedMain = true;
      continue;
    }
    const row = map.get(code)!;
    if (code === "PKG-STANDART") {
      total += companionStandartAzn;
      lines.push({
        role: "companion",
        code,
        amount: companionStandartAzn,
        note: `Standart companion (+${companionStandartAzn})`,
      });
    } else {
      const half = halfOcc2(row);
      total += half;
      lines.push({
        role: "companion",
        code,
        amount: half,
        note: `half occupancy-2 (${row.occ2}/2)`,
      });
    }
  }
  return { total, lines };
}
