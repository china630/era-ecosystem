/**
 * FO commercial source → counterparty picker (Nafta).
 * Codes: WALKIN | AGENCY | BOOKING | CORPORATE (legacy OTA treated as BOOKING).
 * Source is the sell path, not Opera “how they physically arrived”.
 */

export type BookingSourceKind = 'WALKIN' | 'AGENCY' | 'BOOKING' | 'CORPORATE' | 'OTHER';

export type SalesContractCounterparty = 'AGENCY' | 'CORPORATE';

export type SalesContractPick = {
  id: string;
  agencyId: string | null;
  companyId: string | null;
  counterpartyType?: SalesContractCounterparty | string | null;
};

const OTA_RE =
  /BOOKING|EXPEDIA|OTA|HALAL|AGODA|AIRBNB|CHANNEL|BOOKING\.COM|BOOKING-COM|EXELY|OSTROVOK/i;

export function bookingSourceKind(code: string | undefined | null): BookingSourceKind {
  const c = (code ?? '').trim().toUpperCase();
  if (!c) return 'OTHER';
  if (c === 'WALKIN' || c === 'WALK-IN' || c === 'WALK_IN') return 'WALKIN';
  if (c === 'AGENCY' || c === 'AGENT' || c === 'TRAVEL') return 'AGENCY';
  if (c === 'BOOKING' || c === 'OTA' || c === 'CHANNEL') return 'BOOKING';
  if (c === 'CORPORATE' || c === 'CORP') return 'CORPORATE';
  return 'OTHER';
}

/** Nafta Agency rows used as OTA / Booking.com / Expedia counterparts. */
export function isOtaAgency(code: string, name?: string | null): boolean {
  return OTA_RE.test(code) || OTA_RE.test(name ?? '');
}

export function contractCounterpartyType(
  row: Pick<SalesContractPick, 'counterpartyType' | 'companyId' | 'agencyId'>,
): SalesContractCounterparty {
  if (row.counterpartyType === 'CORPORATE' || row.counterpartyType === 'AGENCY') {
    return row.counterpartyType;
  }
  if (row.companyId && !row.agencyId) return 'CORPORATE';
  return 'AGENCY';
}

/** Apply one contract to stay FKs: corporate clears TA; agency contract does not clear Company CL. */
export function fksFromSalesContract(contract: SalesContractPick): {
  agencyId: string | null | undefined;
  companyId: string | null | undefined;
} {
  if (contractCounterpartyType(contract) === 'CORPORATE') {
    return { agencyId: '', companyId: contract.companyId ?? undefined };
  }
  return { agencyId: contract.agencyId ?? undefined, companyId: undefined };
}

/** Walk-in and Corporate sell paths do not persist a travel-agent FK. */
export function persistCounterpartyIds(opts: {
  sourceKind: BookingSourceKind;
  agencyId?: string | null;
  companyId?: string | null;
}): { agencyId: string | null; companyId: string | null } {
  const companyId = (opts.companyId ?? '').trim() || null;
  if (opts.sourceKind === 'WALKIN' || opts.sourceKind === 'CORPORATE') {
    return { agencyId: null, companyId };
  }
  return { agencyId: (opts.agencyId ?? '').trim() || null, companyId };
}

/**
 * One salesContractId per stay. Source kind selects AGENCY vs CORPORATE contracts;
 * then filter by the matching profile FK.
 */
export function contractsForSource<T extends SalesContractPick>(
  contracts: T[],
  opts: { sourceKind: BookingSourceKind; agencyId?: string; companyId?: string },
): T[] {
  const agencyId = (opts.agencyId ?? '').trim();
  const companyId = (opts.companyId ?? '').trim();
  if (opts.sourceKind === 'WALKIN' || opts.sourceKind === 'OTHER') return [];
  if (opts.sourceKind === 'CORPORATE') {
    return contracts.filter((c) => {
      if (contractCounterpartyType(c) !== 'CORPORATE') return false;
      if (!companyId || !c.companyId) return true;
      return c.companyId === companyId;
    });
  }
  return contracts.filter((c) => {
    if (contractCounterpartyType(c) !== 'AGENCY') return false;
    if (!agencyId || !c.agencyId) return true;
    return c.agencyId === agencyId;
  });
}
