/** Lodging gross that early checkout will void, per folio id (from preview `chargePlans`). */
export function earlyReversalByFolio(
  plans: Array<{ kind: string; folioId: string; amount?: number; voidAmount?: number }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const plan of plans) {
    const gross = plan.kind === 'void' ? Number(plan.amount ?? 0) : Number(plan.voidAmount ?? 0);
    out[plan.folioId] = (out[plan.folioId] ?? 0) + gross;
  }
  return out;
}
