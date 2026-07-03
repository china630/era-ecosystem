/** Minimal ticket fields used for settlement routing (mirrors clinic patientOrigin). */
export type TicketBillingShape = {
  roomChargeReservationId?: string | null;
  serviceChannel?: string | null;
};

export type TicketSettlement = "LOCAL_CASHIER" | "HOTEL_FOLIO" | "HOTEL_HUB";

export type OperatingModeLike = {
  mode: "STANDALONE" | "DEPARTMENT";
  parentOrgId: string | null;
  fiscalRouting: "OWN" | "PARENT";
  revenueRouting: "OWN" | "PARENT";
};

/**
 * In-house guest: linked to an hotel reservation/room or opened as room service.
 * Walk-in / takeaway / dine-in without link → local POS cashier.
 */
export function isInHouseTicket(ticket: TicketBillingShape): boolean {
  if (ticket.roomChargeReservationId?.trim()) return true;
  return ticket.serviceChannel === "ROOM_SERVICE";
}

export function isWalkInSettlement(ticket: TicketBillingShape): boolean {
  return !isInHouseTicket(ticket);
}

export function shouldRouteInHouseToHotelFolio(mode: OperatingModeLike | null): boolean {
  if (!mode) return true;
  return (
    mode.mode === "DEPARTMENT" &&
    mode.revenueRouting === "PARENT" &&
    Boolean(mode.parentOrgId)
  );
}

/**
 * Where this ticket's revenue settles (pure — pass operating mode when known).
 */
export function resolveTicketSettlementSync(
  ticket: TicketBillingShape,
  mode: OperatingModeLike | null = null,
  deferWalkInToHub = false,
): TicketSettlement {
  if (!isInHouseTicket(ticket)) {
    return deferWalkInToHub ? "HOTEL_HUB" : "LOCAL_CASHIER";
  }

  if (shouldRouteInHouseToHotelFolio(mode)) return "HOTEL_FOLIO";

  // Legacy quartet / explicit reservation link still posts to PMS folio.
  if (ticket.roomChargeReservationId?.trim() || ticket.serviceChannel === "ROOM_SERVICE") {
    return "HOTEL_FOLIO";
  }

  return "LOCAL_CASHIER";
}

/** Walk-in and dine-in without hotel link fiscalize at POS unless deferred to hub. */
export function shouldFiscalizeAtPos(settlement: TicketSettlement): boolean {
  return settlement === "LOCAL_CASHIER";
}

export function payBlockedReason(settlement: TicketSettlement): string | null {
  if (settlement === "HOTEL_FOLIO") {
    return "In-house guest: settle via room charge (hotel folio)";
  }
  if (settlement === "HOTEL_HUB") {
    return "Walk-in: send to reception for payment";
  }
  return null;
}

export function roomChargeBlockedReason(ticket: TicketBillingShape): string | null {
  if (!isInHouseTicket(ticket)) {
    return "Walk-in ticket: pay at register (link in-house guest for room charge)";
  }
  return null;
}
