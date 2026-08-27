import {
  resolveOperatingMode,
  resolveSettlementPolicy,
  shouldDeferWalkInToHub,
  type OperatingModeSnapshot,
} from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
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
  const orgId = requestOrganizationId();
  if (modeOverride !== undefined) {
    const policy = await resolveSettlementPolicy(orgId);
    return resolveTicketSettlementSync(
      ticket,
      modeOverride,
      shouldDeferWalkInToHub(policy),
    );
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
