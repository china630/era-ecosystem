import {
  bookingSourceKind,
  contractCounterpartyType,
  contractsForSource,
  fksFromSalesContract,
  inferSourceKindFromAgency,
  isManualFoSourceKind,
  isOtaAgency,
  persistCounterpartyIds,
} from '@/lib/booking-source-kind';

describe('bookingSourceKind', () => {
  it('maps WALKIN / AGENCY / BOOKING / CORPORATE / WEB', () => {
    expect(bookingSourceKind('WALKIN')).toBe('WALKIN');
    expect(bookingSourceKind('AGENCY')).toBe('AGENCY');
    expect(bookingSourceKind('BOOKING')).toBe('BOOKING');
    expect(bookingSourceKind('OTA')).toBe('BOOKING');
    expect(bookingSourceKind('CORPORATE')).toBe('CORPORATE');
    expect(bookingSourceKind('CORP')).toBe('CORPORATE');
    expect(bookingSourceKind('WEB')).toBe('WEB');
    expect(bookingSourceKind('IBE')).toBe('WEB');
    expect(bookingSourceKind('COMPANY')).toBe('OTHER');
  });

  it('maps ota-ingest channel codes to OTA', () => {
    expect(bookingSourceKind('EXPEDIA')).toBe('BOOKING');
    expect(bookingSourceKind('BOOKING_COM')).toBe('BOOKING');
  });

  it('reception picks only WALKIN / AGENCY / CORPORATE', () => {
    expect(isManualFoSourceKind('WALKIN')).toBe(true);
    expect(isManualFoSourceKind('AGENCY')).toBe(true);
    expect(isManualFoSourceKind('CORPORATE')).toBe(true);
    expect(isManualFoSourceKind('BOOKING')).toBe(false);
    expect(isManualFoSourceKind('WEB')).toBe(false);
  });
});

describe('inferSourceKindFromAgency', () => {
  it('maps Nafta agency rows to the sell path', () => {
    expect(inferSourceKindFromAgency('EXPEDIA', 'EXPEDIA')).toBe('BOOKING');
    expect(inferSourceKindFromAgency('BOOKING.COM', 'BOOKING.COM')).toBe('BOOKING');
    expect(inferSourceKindFromAgency('EXELY.COM', 'EXELY.COM')).toBe('BOOKING');
    expect(inferSourceKindFromAgency('WALKIN MEDICAL', 'WALKIN MEDICAL')).toBe('WALKIN');
    expect(inferSourceKindFromAgency('MARI', 'MARI TRAVEL MEDICAL')).toBe('AGENCY');
    expect(inferSourceKindFromAgency('', null)).toBeNull();
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

  it('keeps a walk-in-recorded agency row on WALKIN (medical package rules)', () => {
    expect(
      persistCounterpartyIds({ sourceKind: 'WALKIN', agencyId: 'ag-w', agencyIsWalkIn: true }),
    ).toEqual({ agencyId: 'ag-w', companyId: null });
    expect(
      persistCounterpartyIds({ sourceKind: 'WEB', agencyId: 'ag-w', agencyIsWalkIn: true }),
    ).toEqual({ agencyId: null, companyId: null });
  });
});

describe('OTA detection', () => {
  it('does not treat words containing "ota" as OTA', () => {
    expect(isOtaAgency('KOTA', 'Kota Travel')).toBe(false);
    expect(isOtaAgency('OTA', null)).toBe(true);
    expect(bookingSourceKind('CHANNEX')).toBe('BOOKING');
  });

  it('classifies Nafta package walk-in rows as walk-in', () => {
    expect(inferSourceKindFromAgency('PRM-WALKIN', 'Premium paket Walkin')).toBe('WALKIN');
  });
});
