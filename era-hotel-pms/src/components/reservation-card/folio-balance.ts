export function computeGuestFolioBalance(
  folios: Array<{
    type: string;
    charges: Array<{ amount: number }>;
    payments?: Array<{ amount: number }>;
  }>,
): number {
  const guest = folios.find((f) => f.type === 'GUEST') ?? folios[0];
  if (!guest) return 0;
  const charges = guest.charges.reduce((s, c) => s + Number(c.amount), 0);
  const payments = (guest.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  return Math.round((charges - payments) * 100) / 100;
}
