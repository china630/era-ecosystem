/**
 * Folio ledger: Debit | Credit columns (Opera-like).
 * Soft rose on Debit, sky on Credit — not a third ink family.
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

export function ledgerKindLabelKey(kind: LedgerMoneyKind): string {
  if (kind === 'void') return 'voidBadge';
  if (kind === 'adjust') return 'adjustBadge';
  if (kind === 'refund') return 'refundBadge';
  if (kind === 'payment') return 'paymentBadge';
  return 'chargeBadge';
}

/** Debit column: charges, positive adjusts, refunds (cash out / guest owes more). */
export function ledgerDebitAmount(amount: number, kind: LedgerMoneyKind): number | null {
  if (kind === 'void') return null;
  if (kind === 'charge') return Math.abs(amount);
  if (kind === 'refund') return Math.abs(amount);
  if (kind === 'adjust' && amount > 0.009) return amount;
  return null;
}

/** Credit column: payments, negative adjusts. */
export function ledgerCreditAmount(amount: number, kind: LedgerMoneyKind): number | null {
  if (kind === 'void') return null;
  if (kind === 'payment') return Math.abs(amount);
  if (kind === 'adjust' && amount < -0.009) return Math.abs(amount);
  return null;
}

export function ledgerAmountClass(kind: LedgerMoneyKind): string {
  if (kind === 'void') return 'text-[#95A5A6] line-through';
  if (kind === 'charge' || kind === 'adjust') return 'text-rose-700';
  return 'text-sky-700';
}

export function ledgerDebitClass(): string {
  return 'text-right font-mono text-rose-700';
}

export function ledgerCreditClass(): string {
  return 'text-right font-mono text-sky-700';
}

/** Soft column wash for Debit | Credit (Opera-like). */
export function ledgerDebitColumnClass(): string {
  return 'w-24 bg-rose-50/70 text-right font-mono';
}

export function ledgerCreditColumnClass(): string {
  return 'w-24 bg-sky-50/70 text-right font-mono';
}

/** @deprecated Prefer Debit|Credit columns. */
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
