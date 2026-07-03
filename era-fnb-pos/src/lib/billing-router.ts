import {
  resolveOperatingMode,
  resolveSettlementPolicy,
  shouldDeferWalkInToHub,
  satelliteOrganizationId,
  type OperatingModeSnapshot,
} from "@era/satellite-kit";
import {
  resolveTicketSettlementSync,
  type TicketBillingShape,
  type TicketSettlement,
} from "./billing-router-core";

export type {
  OperatingModeLike,
  TicketBillingShape,
  TicketSettlement,
} from "./billing-router-core";
export {
  isInHouseTicket,
  isWalkInSettlement,
  payBlockedReason,
  resolveTicketSettlementSync,
  roomChargeBlockedReason,
  shouldFiscalizeAtPos,
  shouldRouteInHouseToHotelFolio,
} from "./billing-router-core";

export async function resolveTicketSettlement(
  ticket: TicketBillingShape,
  modeOverride?: OperatingModeSnapshot | null,
): Promise<TicketSettlement> {
  const orgId = satelliteOrganizationId();
  if (modeOverride !== undefined) {
    const policy = orgId ? await resolveSettlementPolicy(orgId) : null;
    return resolveTicketSettlementSync(
      ticket,
      modeOverride,
      policy ? shouldDeferWalkInToHub(policy) : false,
    );
  }
  if (!orgId) {
    return resolveTicketSettlementSync(ticket, null, false);
  }
  const [mode, policy] = await Promise.all([
    resolveOperatingMode(orgId),
    resolveSettlementPolicy(orgId),
  ]);
  return resolveTicketSettlementSync(
    ticket,
    mode,
    shouldDeferWalkInToHub(policy),
  );
}
