export function formatFolioBalanceWords(
  net: number,
  labels: { guestOwes: string; overpaid: string; settled: string },
): { text: string; danger: boolean } {
  if (net > 0.01) return { text: `${labels.guestOwes} ${net.toFixed(2)} AZN`, danger: true };
  if (net < -0.01) return { text: `${labels.overpaid} ${Math.abs(net).toFixed(2)} AZN`, danger: false };
  return { text: labels.settled, danger: false };
}

export function computeGuestFolioBalance(
  folios: Array<{
    type: string;
    charges: Array<{ amount: number | string; qty?: number | null }>;
    payments?: Array<{ amount: number | string; kind?: string | null; voidedAt?: string | Date | null }>;
  }>,
): number {
  const guestFolios = folios.filter((folio) => folio.type === 'GUEST');
  const source = guestFolios.length > 0 ? guestFolios : folios.slice(0, 1);
  let net = 0;
  for (const folio of source) {
    for (const charge of folio.charges) {
      const qty = charge.qty == null ? 1 : Number(charge.qty);
      net += Number(charge.amount) * (Number.isFinite(qty) ? qty : 1);
    }
    for (const payment of folio.payments ?? []) {
      if (payment.voidedAt) continue;
      const amount = Number(payment.amount);
      if (!Number.isFinite(amount)) continue;
      net -= payment.kind === 'REFUND' ? -amount : amount;
    }
  }
  return Math.round(net * 100) / 100;
}
