import {
  ledgerCreditAmount,
  ledgerDebitAmount,
  ledgerKindLabelKey,
  ledgerMoneyKind,
} from '@/lib/folio-ledger-display';

describe('folio ledger Debit|Credit', () => {
  it('charges sit in Debit', () => {
    const kind = ledgerMoneyKind({ kind: 'charge' });
    expect(kind).toBe('charge');
    expect(ledgerDebitAmount(100, kind)).toBe(100);
    expect(ledgerCreditAmount(100, kind)).toBeNull();
    expect(ledgerKindLabelKey(kind)).toBe('chargeBadge');
  });

  it('payments sit in Credit', () => {
    const kind = ledgerMoneyKind({ kind: 'payment', paymentKind: 'PAYMENT' });
    expect(ledgerDebitAmount(50, kind)).toBeNull();
    expect(ledgerCreditAmount(50, kind)).toBe(50);
    expect(ledgerKindLabelKey(kind)).toBe('paymentBadge');
  });

  it('refunds sit in Debit', () => {
    const kind = ledgerMoneyKind({ kind: 'payment', paymentKind: 'REFUND' });
    expect(ledgerDebitAmount(25, kind)).toBe(25);
    expect(ledgerCreditAmount(25, kind)).toBeNull();
  });

  it('negative adjust is Credit', () => {
    const kind = ledgerMoneyKind({ kind: 'charge', adjustsChargeId: 'x' });
    expect(ledgerDebitAmount(-10, kind)).toBeNull();
    expect(ledgerCreditAmount(-10, kind)).toBe(10);
  });
});
