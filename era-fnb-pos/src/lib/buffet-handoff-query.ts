/**
 * Compact theoSku query encoding for F&B → Finance HYBRID handoff.
 * Format: MEAT:500|OIL:12.5 (SKU:azn, pipe-separated).
 */

/** Encode theoretical-by-SKU map for URL query (omit non-finite / negative). */
export function encodeTheoSku(bySku: Record<string, number>): string {
  const parts: string[] = [];
  for (const [rawSku, rawAzn] of Object.entries(bySku)) {
    const sku = rawSku.trim().toUpperCase();
    if (!sku) continue;
    const azn = Number(rawAzn);
    if (!Number.isFinite(azn) || azn < 0) continue;
    const rounded = Math.round(azn * 100) / 100;
    parts.push(`${sku}:${rounded}`);
  }
  return parts.join("|");
}

/** Decode theoSku query param into AZN map. Empty / invalid → {}. */
export function decodeTheoSku(raw: string | null | undefined): Record<string, number> {
  if (raw == null || typeof raw !== "string") return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const out: Record<string, number> = {};
  for (const part of trimmed.split("|")) {
    const piece = part.trim();
    if (!piece) continue;
    const colon = piece.indexOf(":");
    if (colon <= 0) continue;
    const sku = piece.slice(0, colon).trim().toUpperCase();
    const azn = Number(piece.slice(colon + 1).trim());
    if (!sku || !Number.isFinite(azn) || azn < 0) continue;
    out[sku] = Math.round(azn * 100) / 100;
  }
  return out;
}

export type FinanceHandoffQueryArgs = {
  from: string;
  to: string;
  outletCode?: string | null;
  posSaleAzn: number;
  posCompAzn: number;
  staffNetAzn: number;
  theoreticalAzn: number;
  theoreticalBySku: Record<string, number>;
};

/**
 * Build query string (no leading `?`, no host) for Finance `/inventory/buffet-food-cost`.
 */
export function buildFinanceHandoffQuery(args: FinanceHandoffQueryArgs): string {
  const q = new URLSearchParams({
    from: args.from,
    to: args.to,
    posSaleAzn: String(Math.round((Number(args.posSaleAzn) || 0) * 100) / 100),
    posCompAzn: String(Math.round((Number(args.posCompAzn) || 0) * 100) / 100),
    staffNetAzn: String(Math.round((Number(args.staffNetAzn) || 0) * 100) / 100),
  });
  const code = args.outletCode?.trim();
  if (code) q.set("outletCode", code);
  const theo = Math.round((Number(args.theoreticalAzn) || 0) * 100) / 100;
  q.set("theoreticalAzn", String(theo));
  const theoSku = encodeTheoSku(args.theoreticalBySku);
  if (theoSku) q.set("theoSku", theoSku);
  return q.toString();
}
