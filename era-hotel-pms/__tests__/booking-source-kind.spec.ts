import {
  bookingSourceKind,
  contractCounterpartyType,
  contractsForSource,
  fksFromSalesContract,
  persistCounterpartyIds,
} from '@/lib/booking-source-kind';

describe('bookingSourceKind', () => {
  it('maps WALKIN / AGENCY / BOOKING / CORPORATE', () => {
    expect(bookingSourceKind('WALKIN')).toBe('WALKIN');
    expect(bookingSourceKind('AGENCY')).toBe('AGENCY');
    expect(bookingSourceKind('BOOKING')).toBe('BOOKING');
    expect(bookingSourceKind('OTA')).toBe('BOOKING');
    expect(bookingSourceKind('CORPORATE')).toBe('CORPORATE');
    expect(bookingSourceKind('CORP')).toBe('CORPORATE');
    expect(bookingSourceKind('COMPANY')).toBe('OTHER');
  });
});

describe('contractsForSource', () => {
  const agency = {
    id: 'a',
    agencyId: 'ag-1',
    companyId: null as string | null,
    counterpartyType: 'AGENCY' as const,
  };
  const corp = {
    id: 'c',
    agencyId: null as string | null,
    companyId: 'co-1',
    counterpartyType: 'CORPORATE' as const,
  };

  it('hides B2B contracts on walk-in', () => {
    expect(contractsForSource([agency, corp], { sourceKind: 'WALKIN' })).toEqual([]);
  });

  it('lists only agency contracts for AGENCY source', () => {
    expect(contractsForSource([agency, corp], { sourceKind: 'AGENCY', agencyId: 'ag-1' })).toEqual([
      agency,
    ]);
  });

  it('lists only corporate contracts for CORPORATE source', () => {
    expect(
      contractsForSource([agency, corp], { sourceKind: 'CORPORATE', companyId: 'co-1' }),
    ).toEqual([corp]);
  });

  it('infers CORPORATE from companyId when type missing', () => {
    const legacy = { id: 'x', agencyId: null, companyId: 'co-1', counterpartyType: null };
    expect(contractCounterpartyType(legacy)).toBe('CORPORATE');
  });

  it('corporate contract clears agency FK', () => {
    expect(fksFromSalesContract(corp)).toEqual({ agencyId: '', companyId: 'co-1' });
    expect(fksFromSalesContract(agency)).toEqual({ agencyId: 'ag-1', companyId: undefined });
  });

  it('walk-in and corporate persist no travel-agent id', () => {
    expect(
      persistCounterpartyIds({ sourceKind: 'WALKIN', agencyId: 'ag-1', companyId: 'co-1' }),
    ).toEqual({ agencyId: null, companyId: 'co-1' });
    expect(
      persistCounterpartyIds({ sourceKind: 'CORPORATE', agencyId: 'ag-1', companyId: 'co-1' }),
    ).toEqual({ agencyId: null, companyId: 'co-1' });
    expect(
      persistCounterpartyIds({ sourceKind: 'AGENCY', agencyId: 'ag-1', companyId: 'co-1' }),
    ).toEqual({ agencyId: 'ag-1', companyId: 'co-1' });
  });
});
