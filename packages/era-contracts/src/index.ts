/**
 * @era/contracts — shared cross-system types and event schemas.
 * Phase 3+ will migrate satellite events and billing enums here from domain apps.
 */

/** Aligns with control-plane TariffTier ladder (TIER_0 … TIER_3). */
export enum BillingTierEnum {
  TIER_0 = "TIER_0",
  TIER_1 = "TIER_1",
  TIER_2 = "TIER_2",
  TIER_3 = "TIER_3",
}

export type BillingStatusDto = "ACTIVE" | "SOFT_BLOCK" | "HARD_BLOCK";

export type ValidateEntitlementRequest = {
  organizationId: string;
  userId?: string;
  method: string;
  path: string;
  isSuperAdmin?: boolean;
};

export type ValidateEntitlementResponse = {
  allowed: boolean;
  billingStatus: BillingStatusDto;
  code?: string;
  message?: string;
  httpStatus?: number;
};

export type SatelliteHotelEvent = {
  type: "hotel.reservation.created" | "hotel.reservation.updated";
  organizationId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
};

export * from "./events";
export * from "./subscription";
