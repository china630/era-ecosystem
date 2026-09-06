export type PendingReceiptLine = { qty: number; name: string };

/** F&B hub description: `FB OUTLET: 2x Qara çay; 1x Pizza`. Clinic is usually a single sentence. */
export function parsePendingReceiptLines(description: string): PendingReceiptLine[] {
  const raw = description.trim();
  if (!raw) return [];
  const body = raw.includes(': ') ? raw.slice(raw.indexOf(': ') + 2).trim() : raw;
  const parts = body
    .split(/;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.map((p) => {
    const m = p.match(/^(\d+(?:[.,]\d+)?)\s*[x×]\s*(.+)$/i);
    if (m) {
      return { qty: Number(String(m[1]).replace(',', '.')), name: m[2]!.trim() };
    }
    return { qty: 1, name: p };
  });
}
