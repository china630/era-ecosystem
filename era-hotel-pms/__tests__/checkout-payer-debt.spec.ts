jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/integration/event-dispatcher', () => ({ dispatchReservationCompleted: jest.fn() }));
jest.mock('@/lib/services/city-ledger-gate.service', () => ({ assertCanTransferToCityLedger: jest.fn() }));
jest.mock('@/lib/services/fiscal-document.service', () => ({
  createFiscalDocumentsOnCheckout: jest.fn(),
  issueFolioInvoice: jest.fn(),
}));
jest.mock('@/lib/services/reservation.service', () => ({ getReservation: jest.fn() }));
jest.mock('@/lib/services/share-assignment.service', () => ({ releaseDoorAfterShareDeparture: jest.fn() }));
jest.mock('@/lib/satellite-audit', () => ({ recordHotelAudit: jest.fn() }));

import { Prisma } from '@prisma/client';
import { assertPayerDebtResolved } from '@/lib/services/checkout.service';

const d = (n: number) => new Prisma.Decimal(n);

function folio(type: string, charged: number, paid: number) {
  return {
    type,
    charges: [{ amount: d(charged), qty: 1 }],
    payments: paid ? [{ amount: d(paid), kind: 'PAYMENT', voidedAt: null }] : [],
  };
}

describe('assertPayerDebtResolved', () => {
  it('rejects agency debt when City Ledger was not chosen explicitly', () => {
    expect(() => assertPayerDebtResolved([folio('AGENCY', 300, 0)], undefined)).toThrow(
      /still owes 300\.00 AZN/,
    );
    expect(() => assertPayerDebtResolved([folio('COMPANY', 120, 20)], false)).toThrow(/City Ledger/);
  });

  it('allows payer debt only with an explicit City Ledger choice', () => {
    expect(() => assertPayerDebtResolved([folio('AGENCY', 300, 0)], true)).not.toThrow();
  });

  it('ignores guest folios and settled payer folios', () => {
    expect(() =>
      assertPayerDebtResolved([folio('GUEST', 478, 0), folio('AGENCY', 300, 300)], undefined),
    ).not.toThrow();
  });
});
