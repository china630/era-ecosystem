import { prisma } from '@/lib/prisma';

/** Early/late check-in/out fee policy. */
export type EarlyLatePolicy = {
  standardCheckInTime: string;
  standardCheckOutTime: string;
  earlyCheckInFeeMode: 'FIXED' | 'PERCENT_OF_NIGHT' | 'HOURLY';
  earlyCheckInFeeAmount: number;
  lateCheckOutFeeMode: 'FIXED' | 'PERCENT_OF_NIGHT' | 'HOURLY';
  lateCheckOutFeeAmount: number;
};

/**
 * Feature flags for pricing behaviour. All default OFF except child % matrix
 * (legacy always-on via ChildPricingMatrix). Hotels opt in when ready.
 */
export type PricingFeaturePolicy = {
  /** Apply rate-plan 2nd/3rd adult + extra-bed supplements. */
  occupancyPricingEnabled: boolean;
  /** Apply YieldRule adjustments by hotel occupancy %. */
  loadBasedPricingEnabled: boolean;
  /** Prefer ChildPricingMatrix.amountOverride when set (else % discount). */
  childAbsolutePricingEnabled: boolean;
};

/** Channel / OTA distribution feature flags (default OFF). */
export type ChannelFeaturePolicy = {
  /**
   * When true, fire-and-forget ARI push after stop-sell create/delete.
   * Default false — operators push manually from the channel page.
   */
  channelAutoPushEnabled: boolean;
};

/** Agency portal confirm behaviour (default OFF → OPTION + FO inbox). */
export type AgencyPortalPolicy = {
  agencyPortalAutoConfirm: boolean;
  /** Hours to hold OPTION before soft-release (informational for P1 UI). */
  agencyPortalOptionHoldHours: number;
};

export type CityLedgerPolicy = {
  /**
   * What to do when we need to transfer agency/company folio to City Ledger
   * but Finance has no local counterparty card for the agency/company VÖEN.
   */
  cityLedgerMissingCounterparty: "BLOCK_CHECKOUT" | "DEFER_HANDOFF" | "AUTO_CREATE";

  /**
   * When true: last-day year-end action is blocked/refused while City Ledger
   * has any OPEN agency/company balances.
   */
  yearEndBlockIfOpenCityLedger: boolean;
};

export type HotelPolicy = EarlyLatePolicy &
  PricingFeaturePolicy &
  ChannelFeaturePolicy &
  AgencyPortalPolicy &
  CityLedgerPolicy;

export const DEFAULT_HOTEL_POLICY: HotelPolicy = {
  standardCheckInTime: '14:00',
  standardCheckOutTime: '12:00',
  earlyCheckInFeeMode: 'PERCENT_OF_NIGHT',
  earlyCheckInFeeAmount: 50,
  lateCheckOutFeeMode: 'PERCENT_OF_NIGHT',
  lateCheckOutFeeAmount: 50,
  occupancyPricingEnabled: false,
  loadBasedPricingEnabled: false,
  childAbsolutePricingEnabled: false,
  channelAutoPushEnabled: false,
  agencyPortalAutoConfirm: false,
  agencyPortalOptionHoldHours: 48,
  cityLedgerMissingCounterparty: "BLOCK_CHECKOUT",
  yearEndBlockIfOpenCityLedger: true,
};

function parsePolicy(raw: string | null | undefined): HotelPolicy {
  if (!raw) return { ...DEFAULT_HOTEL_POLICY };
  try {
    const parsed = JSON.parse(raw) as Partial<HotelPolicy>;
    return { ...DEFAULT_HOTEL_POLICY, ...parsed };
  } catch {
    return { ...DEFAULT_HOTEL_POLICY };
  }
}

export async function getHotelPolicy(): Promise<HotelPolicy> {
  const profile = await prisma.hotelProfile.findFirst({ orderBy: { createdAt: 'asc' } });
  return parsePolicy(profile?.policyJson);
}

export async function updateHotelPolicy(patch: Partial<HotelPolicy>): Promise<HotelPolicy> {
  const profile = await prisma.hotelProfile.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!profile) throw new Error('Hotel profile not found');

  const next: HotelPolicy = { ...parsePolicy(profile.policyJson), ...patch };
  await prisma.hotelProfile.update({
    where: { id: profile.id },
    data: { policyJson: JSON.stringify(next) },
  });
  return next;
}
