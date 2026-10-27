/**
 * Folio ledger ink: rose = charge, sky = money movement.
 * Direction is the sign and kind label — not a third palette.
 */

export type LedgerMoneyKind = 'charge' | 'adjust' | 'payment' | 'refund' | 'void';

export function ledgerMoneyKind(row: {
  kind: 'charge' | 'payment';
  adjustsChargeId?: string | null;
  paymentKind?: string | null;
  voidedAt?: string | Date | null;
}): LedgerMoneyKind {
  if (row.voidedAt) return 'void';
  if (row.kind === 'payment') {
    return row.paymentKind === 'REFUND' ? 'refund' : 'payment';
  }
  return row.adjustsChargeId ? 'adjust' : 'charge';
}

export function ledgerAmountClass(kind: LedgerMoneyKind): string {
  if (kind === 'void') return 'text-[#95A5A6] line-through';
  if (kind === 'charge' || kind === 'adjust') return 'text-rose-700';
  return 'text-sky-700';
}

export function ledgerRowClass(kind: LedgerMoneyKind): string {
  if (kind === 'void') return 'bg-[#F4F6F7] text-[#95A5A6]';
  if (kind === 'charge' || kind === 'adjust') return 'bg-rose-50';
  return 'bg-sky-50';
}

/** Signed display: payment +, refund −, adjust keeps amount sign, charge unsigned. */
export function formatLedgerAmount(amount: number, kind: LedgerMoneyKind): string {
  const abs = Math.abs(amount).toFixed(2);
  if (kind === 'payment') return `+${abs}`;
  if (kind === 'refund') return `−${abs}`;
  if (kind === 'adjust') {
    if (amount > 0.009) return `+${abs}`;
    if (amount < -0.009) return `−${abs}`;
    return abs;
  }
  return abs;
}
