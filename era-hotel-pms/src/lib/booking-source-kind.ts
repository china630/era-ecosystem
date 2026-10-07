/**
 * FO commercial source → counterparty picker (Nafta).
 * Manual: WALKIN | AGENCY | CORPORATE. Automatic: BOOKING (OTA) | WEB.
 * Source is the sell path, not Opera “how they physically arrived”.
 */

export type BookingSourceKind = 'WALKIN' | 'AGENCY' | 'BOOKING' | 'CORPORATE' | 'WEB' | 'OTHER';

export type SalesContractCounterparty = 'AGENCY' | 'CORPORATE';

export type SalesContractPick = {
  id: string;
  agencyId: string | null;
  companyId: string | null;
  counterpartyType?: SalesContractCounterparty | string | null;
};

const OTA_RE =
  /BOOKING|EXPEDIA|\bOTA\b|HALAL|AGODA|AIRBNB|CHANNEL|CHANNEX|EXELY|OSTROVOK/i;

export function bookingSourceKind(code: string | undefined | null): BookingSourceKind {
  const c = (code ?? '').trim().toUpperCase();
  if (!c) return 'OTHER';
  if (c === 'WALKIN' || c === 'WALK-IN' || c === 'WALK_IN') return 'WALKIN';
  if (c === 'AGENCY' || c === 'AGENT' || c === 'TRAVEL') return 'AGENCY';
  if (c === 'BOOKING' || c === 'OTA' || c === 'CHANNEL') return 'BOOKING';
  if (c === 'CORPORATE' || c === 'CORP') return 'CORPORATE';
  if (c === 'WEB' || c === 'IBE' || c === 'WEBSITE') return 'WEB';
  if (isOtaAgency(c)) return 'BOOKING';
  return 'OTHER';
}

/** `reservationCard.source*` label for a source row; unknown codes keep their own name. */
export function sourceKindLabel(
  t: (key: string) => string,
  kind: BookingSourceKind,
  fallback: string,
): string {
  if (kind === 'WALKIN') return t('sourceWalkIn');
  if (kind === 'AGENCY') return t('sourceAgency');
  if (kind === 'CORPORATE') return t('sourceCorporate');
  if (kind === 'BOOKING') return t('sourceOta');
  if (kind === 'WEB') return t('sourceWeb');
  return fallback;
}

/** Reception picks these. Website stays a channel stamp. Corporate is a company profile, not a source. */
export function isManualFoSourceKind(kind: BookingSourceKind): boolean {
  return kind === 'WALKIN' || kind === 'AGENCY' || kind === 'BOOKING';
}

/**
 * Nafta stored walk-in arrivals as Agency rows (`WALKIN MEDICAL`, `Premium paket Walkin`),
 * not as travel agents.
 */
export function isWalkInRecordedAgency(code?: string | null, name?: string | null): boolean {
  return /\bWALK[\s_-]*IN\b/i.test(`${code ?? ''} ${name ?? ''}`);
}

/** Empty BookingSource + known agency row → sell path. */
export function inferSourceKindFromAgency(
  code?: string | null,
  name?: string | null,
): BookingSourceKind | null {
  const blob = `${code ?? ''} ${name ?? ''}`.trim();
  if (!blob) return null;
  if (isWalkInRecordedAgency(code, name)) return 'WALKIN';
  if (isOtaAgency(code, name)) return 'BOOKING';
  return 'AGENCY';
}

/** Nafta Agency rows used as OTA / Booking.com / Expedia counterparts. */
export function isOtaAgency(code?: string | null, name?: string | null): boolean {
  return OTA_RE.test(code ?? '') || OTA_RE.test(name ?? '');
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

/** Apply one contract to the profile that owns the rate. The other profile stays. */
export function fksFromSalesContract(contract: SalesContractPick): {
  agencyId: string | null | undefined;
  companyId: string | null | undefined;
} {
  if (contractCounterpartyType(contract) === 'CORPORATE') {
    return { agencyId: undefined, companyId: contract.companyId ?? undefined };
  }
  return { agencyId: contract.agencyId ?? undefined, companyId: undefined };
}

/**
 * Walk-in, website and Corporate sell paths do not persist a travel-agent FK —
 * except a walk-in-recorded Agency row (`WALKIN MEDICAL`, `Premium paket Walkin`),
 * which drives medical package rules and agency reports.
 */
export function persistCounterpartyIds(opts: {
  sourceKind: BookingSourceKind;
  agencyId?: string | null;
  companyId?: string | null;
  agencyIsWalkIn?: boolean;
}): { agencyId: string | null; companyId: string | null } {
  const companyId = (opts.companyId ?? '').trim() || null;
  if (opts.sourceKind === 'WALKIN' && opts.agencyIsWalkIn) {
    return { agencyId: (opts.agencyId ?? '').trim() || null, companyId };
  }
  if (opts.sourceKind === 'WALKIN' || opts.sourceKind === 'WEB') {
    return { agencyId: null, companyId };
  }
  return { agencyId: (opts.agencyId ?? '').trim() || null, companyId };
}

/**
 * One salesContractId per stay. The list is the active contracts of the profiles
 * already chosen. An empty profile does not open every contract of that kind.
 */
export function contractsForSource<T extends SalesContractPick>(
  contracts: T[],
  opts: { sourceKind?: BookingSourceKind; agencyId?: string; companyId?: string },
): T[] {
  const agencyId = (opts.agencyId ?? '').trim();
  const companyId = (opts.companyId ?? '').trim();
  if (!agencyId && !companyId) return [];
  return contracts.filter((c) => {
    const kind = contractCounterpartyType(c);
    if (kind === 'AGENCY' && agencyId && c.agencyId === agencyId) return true;
    if (kind === 'CORPORATE' && companyId && c.companyId === companyId) return true;
    return false;
  });
}
