/**
 * Decode F&B → Finance HYBRID handoff theoSku query (MEAT:500|OIL:12).
 * Mirror of era-fnb-pos buffet-handoff-query decode (keep formats in sync).
 */
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
