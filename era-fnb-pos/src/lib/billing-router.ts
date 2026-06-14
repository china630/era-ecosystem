import {
  resolveOperatingMode,
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
    return resolveTicketSettlementSync(ticket, modeOverride);
  }
  if (!orgId) {
    return resolveTicketSettlementSync(ticket, null);
  }
  const mode = await resolveOperatingMode(orgId);
  return resolveTicketSettlementSync(ticket, mode);
}
