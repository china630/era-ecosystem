import { assertSalesContractStatusTransition } from '@/lib/services/sales-contract-status';

describe('assertSalesContractStatusTransition', () => {
  it('allows DRAFT → ACTIVE and DRAFT → CANCELLED', () => {
    expect(() => assertSalesContractStatusTransition('DRAFT', 'ACTIVE')).not.toThrow();
    expect(() => assertSalesContractStatusTransition('DRAFT', 'CANCELLED')).not.toThrow();
  });

  it('allows ACTIVE → EXPIRED and ACTIVE → CANCELLED', () => {
    expect(() => assertSalesContractStatusTransition('ACTIVE', 'EXPIRED')).not.toThrow();
    expect(() => assertSalesContractStatusTransition('ACTIVE', 'CANCELLED')).not.toThrow();
  });

  it('rejects reopen and illegal jumps', () => {
    expect(() => assertSalesContractStatusTransition('CANCELLED', 'ACTIVE')).toThrow(/Cannot change/);
    expect(() => assertSalesContractStatusTransition('EXPIRED', 'ACTIVE')).toThrow(/Cannot change/);
    expect(() => assertSalesContractStatusTransition('DRAFT', 'EXPIRED')).toThrow(/Cannot change/);
  });

  it('is a no-op for same status', () => {
    expect(() => assertSalesContractStatusTransition('ACTIVE', 'ACTIVE')).not.toThrow();
  });
});
