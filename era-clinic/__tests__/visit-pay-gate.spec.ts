import {
  assertVisitReadyForWork,
  isVisitAwaitingPayment,
  VISIT_AWAITING_PAYMENT,
  visitAwaitingPaymentDenied,
} from "@/domain/visit/visit-pay-gate";

describe("visit pay gate", () => {
  it("treats priced unpaid visits as awaiting payment", () => {
    expect(isVisitAwaitingPayment({ amountNet: 40, settledAt: null })).toBe(true);
    expect(isVisitAwaitingPayment({ amountNet: 0, settledAt: null })).toBe(false);
    expect(
      isVisitAwaitingPayment({ amountNet: 40, settledAt: new Date("2026-10-01") }),
    ).toBe(false);
  });

  it("refuses clinical work while awaiting payment", () => {
    expect(() =>
      assertVisitReadyForWork({ amountNet: 25, settledAt: null }),
    ).toThrow(/awaits payment/i);
    try {
      assertVisitReadyForWork({ amountNet: 25, settledAt: null });
    } catch (err) {
      expect((err as { code?: string }).code).toBe(VISIT_AWAITING_PAYMENT);
    }
    expect(() =>
      assertVisitReadyForWork({ amountNet: 0, settledAt: null }),
    ).not.toThrow();
  });

  it("maps awaiting payment to a 409 HTTP deny shape", () => {
    expect(visitAwaitingPaymentDenied({ amountNet: 10, settledAt: null })).toEqual({
      message: "Visit awaits payment",
      status: 409,
      code: VISIT_AWAITING_PAYMENT,
    });
    expect(visitAwaitingPaymentDenied({ amountNet: 0, settledAt: null })).toBeNull();
  });
});
