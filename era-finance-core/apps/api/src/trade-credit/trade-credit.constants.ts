/** Included managed buyers on the `trade_credit_control` unlock SKU (Phase 0). */
export const TRADE_CREDIT_INCLUDED_BUYERS = 50;

/** Default pickup-grant TTL from issue (hours). */
export const TRADE_CREDIT_DEFAULT_GRANT_TTL_HOURS = 24;

/** Dormant window: limit 0 + AR 0 + no deferred shipment for N days → not billed. */
export const TRADE_CREDIT_DORMANT_DAYS = 30;

export {
  ModuleEntitlement,
} from "../subscription/subscription.constants";
