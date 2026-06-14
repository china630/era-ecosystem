import {
  isInHouseTicket,
  isWalkInSettlement,
  payBlockedReason,
  resolveTicketSettlementSync,
  roomChargeBlockedReason,
  shouldFiscalizeAtPos,
  type TicketSettlement,
} from "../src/lib/billing-router-core";

describe("billing-router-core", () => {
  it("detects in-house via roomChargeReservationId", () => {
    expect(
      isInHouseTicket({ roomChargeReservationId: "res-1", serviceChannel: "DINE_IN" }),
    ).toBe(true);
  });

  it("detects in-house via ROOM_SERVICE channel", () => {
    expect(isInHouseTicket({ serviceChannel: "ROOM_SERVICE" })).toBe(true);
  });

  it("treats WALK_IN without link as walk-in settlement", () => {
    expect(isWalkInSettlement({ serviceChannel: "WALK_IN" })).toBe(true);
    expect(isInHouseTicket({ serviceChannel: "WALK_IN" })).toBe(false);
  });

  it("treats DINE_IN without link as local cashier", () => {
    const settlement = resolveTicketSettlementSync({ serviceChannel: "DINE_IN" });
    expect(settlement).toBe("LOCAL_CASHIER");
  });

  it("routes linked ticket to hotel folio under DEPARTMENT parent routing", () => {
    const settlement = resolveTicketSettlementSync(
      { roomChargeReservationId: "550e8400-e29b-41d4-a716-446655440000" },
      {
        mode: "DEPARTMENT",
        parentOrgId: "parent-1",
        fiscalRouting: "PARENT",
        revenueRouting: "PARENT",
      },
    );
    expect(settlement).toBe("HOTEL_FOLIO");
  });

  it("walk-in on DEPARTMENT org still uses local cashier", () => {
    const settlement = resolveTicketSettlementSync(
      { serviceChannel: "WALK_IN" },
      {
        mode: "DEPARTMENT",
        parentOrgId: "parent-1",
        fiscalRouting: "PARENT",
        revenueRouting: "PARENT",
      },
    );
    expect(settlement).toBe("LOCAL_CASHIER");
  });

  it("blocks pay for hotel folio settlement", () => {
    expect(payBlockedReason("HOTEL_FOLIO" as TicketSettlement)).toMatch(/room charge/i);
    expect(payBlockedReason("LOCAL_CASHIER" as TicketSettlement)).toBeNull();
  });

  it("fiscalizes at POS only for local cashier", () => {
    expect(shouldFiscalizeAtPos("LOCAL_CASHIER")).toBe(true);
    expect(shouldFiscalizeAtPos("HOTEL_FOLIO")).toBe(false);
  });

  it("blocks room charge for walk-in tickets", () => {
    expect(roomChargeBlockedReason({ serviceChannel: "WALK_IN" })).toMatch(/pay at register/i);
    expect(roomChargeBlockedReason({ roomChargeReservationId: "x" })).toBeNull();
  });
});
